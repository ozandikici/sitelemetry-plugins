#!/usr/bin/env node

import { runLauncher } from './launcher-core.mjs';

const LAUNCHER_VERSION = '0.4.0';
const RELEASE_ORIGIN = 'https://sitelemetry.com';
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA0RH7lKaBxNt9Q6SnExdbK8r7U++q9JRUdvJCsiAVoeU=
-----END PUBLIC KEY-----`;

try {
  await runLauncher({
    launcherVersion: LAUNCHER_VERSION,
    releaseOrigin: RELEASE_ORIGIN,
    manifestUrl: `${RELEASE_ORIGIN}/downloads/local-agent/stable/manifest.json`,
    signatureUrl: `${RELEASE_ORIGIN}/downloads/local-agent/stable/manifest.json.sig`,
    publicKeyPem: PUBLIC_KEY_PEM
  });
} catch (error) {
  process.stderr.write(`Sitelemetry Local Agent launcher stopped: ${error?.message || error}\n`);
  process.exitCode = 1;
}
