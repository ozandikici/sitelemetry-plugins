# Verified Local Agent launcher

The plugin does not contain Sitelemetry's proprietary application or
audit-engine source. It contains a small, reviewable launcher that:

1. downloads a release manifest from the pinned `https://sitelemetry.com` origin;
2. verifies the raw manifest with Sitelemetry's embedded Ed25519 public key;
3. downloads the exact platform binary without following redirects;
4. verifies its signed size and SHA-256 digest before every execution; and
5. runs it over stdio with a reduced environment and `shell: false`.

The verified binary is cached in the current user's operating-system cache
directory. The Local Agent sends no website content, source, findings,
credentials, or URLs to Sitelemetry Cloud. It returns audit requests and
results to the MCP client, where the client's model provider may process them
under the user's client/provider settings. Only the signed release manifest
and platform binary are fetched from Sitelemetry by the launcher.

The launcher fails closed when no verified release is available. It never
falls back to an unpackaged JavaScript runtime, a PATH executable, or a
user-supplied download URL.
Sitelemetry's release signing key is not stored in the plugin or public
distribution; only the public verification key is embedded in the launcher.

Automatic site discovery stays on loopback and probes a bounded set of common
development ports over HTTP and certificate-valid HTTPS. Self-signed HTTPS is
not auto-discovered and is never made trusted by disabling certificate checks;
provide its explicit clean loopback URL and trust the development CA in the
runtime before running content audits.
