import {
  createHash,
  createPublicKey,
  randomBytes,
  verify as verifySignature
} from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rmdir,
  rm,
  stat
} from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const MANIFEST_LIMIT = 64 * 1024;
const SIGNATURE_LIMIT = 1024;
const ARTIFACT_LIMIT = 220 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const LOCK_TIMEOUT_MS = 35_000;
const LOCK_STALE_MS = 120_000;
const ALLOWED_MANIFEST_KEYS = Object.freeze([
  'schemaVersion',
  'keyId',
  'releaseSequence',
  'version',
  'publishedAt',
  'expiresAt',
  'minLauncherVersion',
  'artifacts'
]);
const ALLOWED_ARTIFACT_KEYS = Object.freeze(['path', 'sha256', 'size']);

export async function runLauncher(config) {
  const trustedConfig = normalizeConfig(config);
  const cacheRoot = defaultCacheRoot();
  await ensurePrivateDirectory(cacheRoot);

  const release = await withCacheLock(cacheRoot, async () => {
    const signed = await loadSignedManifest(trustedConfig, cacheRoot);
    const manifest = parseReleaseManifest(signed.manifestBytes, {
      expectedOrigin: trustedConfig.releaseOrigin,
      launcherVersion: trustedConfig.launcherVersion,
      now: Date.now()
    });
    verifyManifestSignature(signed.manifestBytes, signed.signatureBytes, trustedConfig.publicKeyPem);
    await enforceNoDowngrade(cacheRoot, manifest);

    const platformKey = currentPlatformKey();
    const artifact = manifest.artifacts[platformKey];
    if (!artifact) {
      throw new Error(`Sitelemetry Local Agent does not provide a binary for ${platformKey}.`);
    }

    const executable = await obtainVerifiedArtifact({
      cacheRoot,
      releaseOrigin: trustedConfig.releaseOrigin,
      manifest,
      artifact,
      platformKey
    });
    await verifyAgentHandshake(executable, manifest.version);
    await persistAcceptedRelease(cacheRoot, manifest, platformKey, executable);
    return { executable, manifest };
  });

  return spawnAgent(release.executable, cacheRoot);
}

export function normalizeConfig(config) {
  const releaseOrigin = new URL(String(config?.releaseOrigin || ''));
  if (
    releaseOrigin.protocol !== 'https:'
    || releaseOrigin.username
    || releaseOrigin.password
    || releaseOrigin.port
    || releaseOrigin.pathname !== '/'
    || releaseOrigin.search
    || releaseOrigin.hash
  ) {
    throw new Error('Local Agent release origin must be a credential-free HTTPS origin on port 443.');
  }

  const manifestUrl = exactReleaseUrl(config?.manifestUrl, releaseOrigin.origin);
  const signatureUrl = exactReleaseUrl(config?.signatureUrl, releaseOrigin.origin);
  if (!String(config?.publicKeyPem || '').includes('BEGIN PUBLIC KEY')) {
    throw new Error('Local Agent launcher is missing its release verification key.');
  }

  return Object.freeze({
    releaseOrigin: releaseOrigin.origin,
    manifestUrl,
    signatureUrl,
    publicKeyPem: String(config.publicKeyPem),
    launcherVersion: strictSemver(config?.launcherVersion, 'launcherVersion')
  });
}

export function exactReleaseUrl(raw, expectedOrigin) {
  const url = new URL(String(raw || ''));
  if (
    url.origin !== expectedOrigin
    || url.protocol !== 'https:'
    || url.username
    || url.password
    || url.port
    || url.hash
  ) {
    throw new Error('Local Agent release URL escaped the pinned Sitelemetry HTTPS origin.');
  }
  return url.toString();
}

export function parseReleaseManifest(rawBytes, {
  expectedOrigin,
  launcherVersion,
  now = Date.now()
} = {}) {
  const bytes = asBoundedBytes(rawBytes, MANIFEST_LIMIT, 'release manifest');
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('Local Agent release manifest is not valid JSON.');
  }

  assertPlainRecord(manifest, 'release manifest');
  assertExactKeys(manifest, ALLOWED_MANIFEST_KEYS, 'release manifest');
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported Local Agent release manifest schema.');
  if (!/^sitelemetry-local-agent-\d{4}-\d{2}$/.test(manifest.keyId)) {
    throw new Error('Local Agent release manifest contains an invalid signing key id.');
  }
  if (!Number.isSafeInteger(manifest.releaseSequence) || manifest.releaseSequence < 1) {
    throw new Error('Local Agent release sequence must be a positive integer.');
  }

  const version = strictSemver(manifest.version, 'version');
  const minimum = strictSemver(manifest.minLauncherVersion, 'minLauncherVersion');
  if (compareSemver(launcherVersion, minimum) < 0) {
    throw new Error(`Sitelemetry Local Agent launcher ${minimum} or newer is required.`);
  }

  const publishedAt = strictTimestamp(manifest.publishedAt, 'publishedAt');
  const expiresAt = strictTimestamp(manifest.expiresAt, 'expiresAt');
  if (publishedAt > now + 10 * 60_000) throw new Error('Local Agent release manifest is dated in the future.');
  if (expiresAt <= now) throw new Error('Local Agent release manifest has expired.');
  if (expiresAt <= publishedAt || expiresAt - publishedAt > 370 * 24 * 60 * 60_000) {
    throw new Error('Local Agent release manifest has an invalid validity period.');
  }

  assertPlainRecord(manifest.artifacts, 'artifacts');
  const artifactEntries = Object.entries(manifest.artifacts);
  if (!artifactEntries.length || artifactEntries.length > 8) {
    throw new Error('Local Agent release manifest has an invalid artifact set.');
  }

  const artifacts = {};
  for (const [platformKey, artifact] of artifactEntries) {
    if (!/^(?:win32|darwin|linux)-(?:x64|arm64)$/.test(platformKey)) {
      throw new Error(`Unsupported Local Agent artifact platform: ${platformKey}`);
    }
    assertPlainRecord(artifact, `artifact ${platformKey}`);
    assertExactKeys(artifact, ALLOWED_ARTIFACT_KEYS, `artifact ${platformKey}`);
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256)) {
      throw new Error(`Artifact ${platformKey} has an invalid SHA-256 digest.`);
    }
    if (!Number.isSafeInteger(artifact.size) || artifact.size < 1 || artifact.size > ARTIFACT_LIMIT) {
      throw new Error(`Artifact ${platformKey} has an invalid size.`);
    }

    const artifactUrl = exactReleaseUrl(new URL(String(artifact.path || ''), expectedOrigin), expectedOrigin);
    const parsedArtifactUrl = new URL(artifactUrl);
    if (
      parsedArtifactUrl.search
      || !parsedArtifactUrl.pathname.startsWith(`/downloads/local-agent/releases/${version}/`)
      || parsedArtifactUrl.pathname.includes('..')
      || /%2f|%5c/i.test(parsedArtifactUrl.pathname)
    ) {
      throw new Error(`Artifact ${platformKey} has an unsafe release path.`);
    }
    artifacts[platformKey] = Object.freeze({
      path: parsedArtifactUrl.pathname,
      sha256: artifact.sha256,
      size: artifact.size
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    keyId: manifest.keyId,
    releaseSequence: manifest.releaseSequence,
    version,
    publishedAt: manifest.publishedAt,
    expiresAt: manifest.expiresAt,
    minLauncherVersion: minimum,
    manifestSha256: sha256(bytes),
    artifacts: Object.freeze(artifacts)
  });
}

export function verifyManifestSignature(manifestBytes, signatureBytes, publicKeyPem) {
  const manifest = asBoundedBytes(manifestBytes, MANIFEST_LIMIT, 'release manifest');
  const encoded = asBoundedBytes(signatureBytes, SIGNATURE_LIMIT, 'release signature')
    .toString('ascii')
    .trim();
  if (!/^[A-Za-z0-9+/]{80,120}={0,2}$/.test(encoded)) {
    throw new Error('Local Agent release signature has an invalid encoding.');
  }
  const signature = Buffer.from(encoded, 'base64');
  if (signature.length !== 64) throw new Error('Local Agent release signature has an invalid size.');

  let publicKey;
  try {
    publicKey = createPublicKey(publicKeyPem);
  } catch {
    throw new Error('Local Agent release verification key is invalid.');
  }
  if (!verifySignature(null, manifest, publicKey, signature)) {
    throw new Error('Local Agent release signature verification failed.');
  }
  return true;
}

export async function fetchBoundedExact(url, {
  expectedOrigin,
  limit,
  timeoutMs = DOWNLOAD_TIMEOUT_MS,
  fetchImpl = fetch
}) {
  const trustedUrl = exactReleaseUrl(url, expectedOrigin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    const response = await fetchImpl(trustedUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'application/octet-stream, application/json;q=0.9',
        'accept-encoding': 'identity',
        'user-agent': 'Sitelemetry-Local-Agent-Launcher/0.3'
      },
      signal: controller.signal
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error('Local Agent release download refused an HTTP redirect.');
    }
    if (response.status !== 200) {
      throw new Error(`Local Agent release download returned HTTP ${response.status}.`);
    }
    const encoding = String(response.headers.get('content-encoding') || 'identity').toLowerCase();
    if (encoding !== 'identity') throw new Error('Compressed Local Agent release responses are not accepted.');
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && (declared < 0 || declared > limit)) {
      throw new Error('Local Agent release response exceeds its size limit.');
    }

    const chunks = [];
    let total = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Local Agent release response has no body.');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        throw new Error('Local Agent release response exceeds its size limit.');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Local Agent release download timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyFileDigest(file, expectedSize, expectedSha256) {
  const metadata = await stat(file);
  if (!metadata.isFile() || metadata.size !== expectedSize) {
    throw new Error('Cached Local Agent binary has an unexpected size.');
  }
  const digest = createHash('sha256');
  let total = 0;
  for await (const chunk of createReadStream(file)) {
    total += chunk.byteLength;
    if (total > expectedSize) throw new Error('Cached Local Agent binary has an unexpected size.');
    digest.update(chunk);
  }
  if (total !== expectedSize || digest.digest('hex') !== expectedSha256) {
    throw new Error('Cached Local Agent binary failed SHA-256 verification.');
  }
  return true;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function currentPlatformKey(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  if (!/^(?:win32|darwin|linux)-(?:x64|arm64)$/.test(key)) {
    throw new Error(`Sitelemetry Local Agent does not support ${key}.`);
  }
  return key;
}

export function defaultCacheRoot(platform = process.platform) {
  if (platform === 'win32') {
    const root = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.resolve(root, 'Sitelemetry', 'LocalAgent');
  }
  if (platform === 'darwin') {
    return path.resolve(os.homedir(), 'Library', 'Caches', 'com.sitelemetry.local-agent');
  }
  const root = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.resolve(root, 'sitelemetry', 'local-agent');
}

async function loadSignedManifest(config, cacheRoot) {
  const trustDir = path.join(cacheRoot, 'trust');
  await ensurePrivateDirectory(trustDir);
  const manifestCache = path.join(trustDir, 'manifest.json');
  const signatureCache = path.join(trustDir, 'manifest.json.sig');

  try {
    const [manifestBytes, signatureBytes] = await Promise.all([
      fetchBoundedExact(config.manifestUrl, {
        expectedOrigin: config.releaseOrigin,
        limit: MANIFEST_LIMIT,
        timeoutMs: 12_000
      }),
      fetchBoundedExact(config.signatureUrl, {
        expectedOrigin: config.releaseOrigin,
        limit: SIGNATURE_LIMIT,
        timeoutMs: 12_000
      })
    ]);
    verifyManifestSignature(manifestBytes, signatureBytes, config.publicKeyPem);
    await atomicWrite(manifestCache, manifestBytes, 0o600);
    await atomicWrite(signatureCache, signatureBytes, 0o600);
    return { manifestBytes, signatureBytes, source: 'network' };
  } catch (networkError) {
    try {
      const [manifestBytes, signatureBytes] = await Promise.all([
        readBoundedFile(manifestCache, MANIFEST_LIMIT),
        readBoundedFile(signatureCache, SIGNATURE_LIMIT)
      ]);
      verifyManifestSignature(manifestBytes, signatureBytes, config.publicKeyPem);
      process.stderr.write(`Sitelemetry Local Agent: update check unavailable; using verified cache (${networkError.message}).\n`);
      return { manifestBytes, signatureBytes, source: 'cache' };
    } catch {
      throw new Error(`Sitelemetry Local Agent could not obtain a trusted release manifest: ${networkError.message}`);
    }
  }
}

async function obtainVerifiedArtifact({
  cacheRoot,
  releaseOrigin,
  manifest,
  artifact,
  platformKey
}) {
  const artifactDir = path.join(cacheRoot, 'artifacts', artifact.sha256);
  await ensurePrivateDirectory(artifactDir);
  const executableName = platformKey.startsWith('win32-') ? 'sitelemetry-local-agent.exe' : 'sitelemetry-local-agent';
  const executable = path.join(artifactDir, executableName);

  try {
    await rejectSymlink(executable);
    await verifyFileDigest(executable, artifact.size, artifact.sha256);
    return executable;
  } catch {
    await rm(executable, { force: true });
  }

  const artifactUrl = exactReleaseUrl(new URL(artifact.path, releaseOrigin), releaseOrigin);
  const bytes = await fetchBoundedExact(artifactUrl, {
    expectedOrigin: releaseOrigin,
    limit: artifact.size,
    timeoutMs: DOWNLOAD_TIMEOUT_MS
  });
  if (bytes.byteLength !== artifact.size || sha256(bytes) !== artifact.sha256) {
    throw new Error('Downloaded Local Agent binary failed size or SHA-256 verification.');
  }

  await atomicWrite(executable, bytes, 0o700);
  await chmod(executable, 0o700);
  await verifyFileDigest(executable, artifact.size, artifact.sha256);
  return executable;
}

async function verifyAgentHandshake(executable, expectedVersion) {
  const result = spawnSync(executable, ['--self-test'], {
    cwd: path.dirname(executable),
    env: safeChildEnvironment(),
    encoding: 'utf8',
    timeout: 12_000,
    windowsHide: true,
    shell: false,
    maxBuffer: 64 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Downloaded Local Agent binary failed its self-test: ${result.error?.message || result.stderr || result.status}`);
  }

  let handshake;
  try {
    handshake = JSON.parse(String(result.stdout || '').trim());
  } catch {
    throw new Error('Downloaded Local Agent binary returned an invalid self-test response.');
  }
  if (
    handshake?.name !== 'sitelemetry-local'
    || handshake?.version !== expectedVersion
    || handshake?.networkPolicy !== 'loopback-only'
  ) {
    throw new Error('Downloaded Local Agent binary identity did not match the signed release.');
  }
}

function spawnAgent(executable, cacheRoot) {
  const child = spawn(executable, [], {
    cwd: path.dirname(executable) || cacheRoot,
    env: safeChildEnvironment(),
    stdio: 'inherit',
    windowsHide: true,
    shell: false
  });
  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.once('SIGINT', () => forward('SIGINT'));
  process.once('SIGTERM', () => forward('SIGTERM'));
  child.once('error', (error) => {
    process.stderr.write(`Sitelemetry Local Agent failed to start: ${error.message}\n`);
  });
  child.once('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = Number.isInteger(code) ? code : 1;
  });
  return child;
}

export function safeChildEnvironment() {
  const allow = [
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'TMPDIR',
    'HOME',
    'USERPROFILE',
    'LOCALAPPDATA',
    'APPDATA',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'NO_COLOR',
    'TERM'
  ];
  const env = {};
  for (const key of allow) {
    if (typeof process.env[key] === 'string') env[key] = process.env[key];
  }
  env.SITELEMETRY_LOCAL_AGENT = '1';
  return env;
}

export async function enforceNoDowngrade(cacheRoot, manifest) {
  const statePath = path.join(cacheRoot, 'accepted-release.json');
  let state;
  try {
    state = JSON.parse((await readBoundedFile(statePath, 16 * 1024)).toString('utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('Local Agent accepted-release state is corrupt.');
    return;
  }
  if (
    ![1, 2].includes(state?.schemaVersion)
    || !Number.isSafeInteger(state?.releaseSequence)
    || state.releaseSequence < 1
    || typeof state?.version !== 'string'
    || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(state.version)
    || !/^(?:win32|darwin|linux)-(?:x64|arm64)$/.test(state?.platformKey)
    || !/^[a-f0-9]{64}$/.test(state?.sha256)
    || typeof state?.executable !== 'string'
    || path.basename(state.executable) !== state.executable
  ) {
    throw new Error('Local Agent accepted-release state is invalid.');
  }
  if (manifest.releaseSequence < state.releaseSequence) {
    throw new Error('Local Agent rejected a signed release downgrade.');
  }
  if (
    manifest.releaseSequence === state.releaseSequence
    && manifest.version !== state.version
  ) {
    throw new Error('Local Agent rejected conflicting data for an accepted release sequence.');
  }
  if (manifest.releaseSequence !== state.releaseSequence) return;

  const acceptedArtifact = manifest.artifacts[state.platformKey];
  if (!acceptedArtifact || acceptedArtifact.sha256 !== state.sha256) {
    throw new Error('Local Agent rejected an artifact mutation for an accepted release sequence.');
  }

  if (state.schemaVersion === 1) {
    // Schema 1 already bound sequence/version/platform/SHA-256. A matching
    // artifact may run once and is upgraded atomically to schema 2 after the
    // normal digest verification and binary self-test complete.
    return;
  }

  if (
    !Number.isSafeInteger(state.size)
    || state.size < 1
    || !/^[a-f0-9]{64}$/.test(state.manifestSha256)
    || acceptedArtifact.size !== state.size
    || manifest.manifestSha256 !== state.manifestSha256
  ) {
    throw new Error('Local Agent rejected manifest equivocation for an accepted release sequence.');
  }
}

export async function persistAcceptedRelease(cacheRoot, manifest, platformKey, executable) {
  const artifact = manifest.artifacts[platformKey];
  if (!artifact || !/^[a-f0-9]{64}$/.test(manifest.manifestSha256)) {
    throw new Error('Local Agent cannot persist incomplete accepted-release state.');
  }
  await atomicWrite(
    path.join(cacheRoot, 'accepted-release.json'),
    Buffer.from(`${JSON.stringify({
      schemaVersion: 2,
      releaseSequence: manifest.releaseSequence,
      version: manifest.version,
      platformKey,
      sha256: artifact.sha256,
      size: artifact.size,
      manifestSha256: manifest.manifestSha256,
      executable: path.basename(executable),
      acceptedAt: new Date().toISOString()
    }, null, 2)}\n`),
    0o600
  );
}

export async function withCacheLock(cacheRoot, task) {
  const lock = path.join(cacheRoot, '.update-lock');
  const started = Date.now();
  while (true) {
    try {
      await mkdir(lock, { mode: 0o700 });
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const metadata = await lstat(lock);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new Error('Local Agent cache lock is unsafe.');
      }
      if (Date.now() - metadata.mtimeMs > LOCK_STALE_MS) {
        await rmdir(lock);
        continue;
      }
      if (Date.now() - started > LOCK_TIMEOUT_MS) {
        throw new Error('Timed out waiting for another Local Agent update.');
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  try {
    return await task();
  } finally {
    await rmdir(lock).catch(() => {});
  }
}

async function ensurePrivateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Unsafe Local Agent cache directory: ${directory}`);
  }
  await chmod(directory, 0o700).catch(() => {});
}

async function rejectSymlink(file) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error('Local Agent cache entry is not a regular file.');
  }
}

async function atomicWrite(destination, bytes, mode) {
  const directory = path.dirname(destination);
  await ensurePrivateDirectory(directory);
  const temporary = path.join(
    directory,
    `.${path.basename(destination)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
  );
  let handle;
  try {
    handle = await open(temporary, 'wx', mode);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await chmod(temporary, mode);
    await rename(temporary, destination);
  } finally {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function readBoundedFile(file, limit) {
  const metadata = await stat(file);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > limit) {
    throw new Error(`Unsafe cached file: ${file}`);
  }
  return readFile(file);
}

function assertPlainRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be a JSON object.`);
  }
}

function assertExactKeys(value, allowed, label) {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} contains missing or unsupported fields.`);
  }
}

function asBoundedBytes(value, limit, label) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value || '');
  if (!bytes.byteLength || bytes.byteLength > limit) throw new Error(`${label} has an invalid size.`);
  return bytes;
}

function strictTimestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error(`Local Agent ${label} must be an ISO-8601 UTC timestamp.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`Local Agent ${label} is invalid.`);
  }
  return parsed;
}

function strictSemver(value, label) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value)) {
    throw new Error(`Local Agent ${label} must use strict semantic versioning.`);
  }
  return value;
}

function compareSemver(left, right) {
  const a = strictSemver(left, 'version').split('.').map(Number);
  const b = strictSemver(right, 'version').split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}
