# Sitelemetry for Codex and Claude Code

One plugin installs both Sitelemetry transports:

- `sitelemetry`: the production remote MCP server with Sitelemetry OAuth.
- `sitelemetry-local`: a signed, loopback-only stdio agent for development sites that do not have a public domain yet.

Both cover security posture, technical SEO, AI visibility, analytics and tracking integrations, accessibility, performance, and a combined full audit.

When asked to improve a local site, the bundled skill uses a closed verification
loop: capture a structured baseline, edit the developer's project with the
coding agent's native tools, run project checks, repeat the exact same local
audit, and report fixed, remaining, and introduced findings. Authentication,
data migration, dependency-major, security-policy, infrastructure, destructive,
and other high-risk edits always require an explicit confirmation immediately
before the change.

## Requirements

- Node.js 20 or newer must be available as `node` for the small cross-platform launcher.
- The local website must listen on `localhost`, `127.0.0.1`, or `::1`.
- Automatic discovery probes a bounded set of common development ports over HTTP and certificate-valid HTTPS, including Vite's auto-increment ports. Self-signed HTTPS is intentionally not auto-discovered; provide its explicit clean loopback URL and trust the development CA before content audits.
- A Sitelemetry account is needed only for the remote cloud server. The Local Agent does not sign in, send site data to Sitelemetry Cloud, or consume cloud scan quota. Audit requests and results return to the MCP client and may be processed by its model provider under the user's client/provider settings.
- On first local use, the launcher downloads the exact signed binary for the user's operating system from `https://sitelemetry.com`. The proprietary audit engine source is not included in the plugin.

Codex uses the canonical `.mcp.json` companion and resolves its relative `cwd`
against the installed plugin root. Claude Code's manifest selects
`.mcp.claude.json`, which uses Claude's canonical `${CLAUDE_PLUGIN_ROOT}`
substitution. In both clients the launcher moves with the installed plugin and
never depends on this repository's checkout path.

## Connect

The plugin registers the remote server at `https://sitelemetry.com/mcp`. Codex or Claude Code discovers Sitelemetry's OAuth endpoints and opens browser approval when the remote connection is first used. Local audits use the verified local binary without OAuth.

For production and non-loopback targets, use the remote server and only audit websites you own or are explicitly authorized to test.

The source-private distribution repository contains only this reviewed plugin
surface, not Sitelemetry's application or audit-engine source. After that
repository is published, one line installs Cloud, Local Agent, and the
audit/fix/re-test skill together:

```console
codex plugin marketplace add ozandikici/sitelemetry-plugins && codex plugin add sitelemetry@sitelemetry
```

```console
claude plugin marketplace add ozandikici/sitelemetry-plugins && claude plugin install sitelemetry@sitelemetry
```

PowerShell users can replace `&&` with
`; if ($LASTEXITCODE -eq 0) { <second command> }`, as shown in the public
distribution README.

If a plugin marketplace is unavailable, copy and paste the matching
remote-only setup:

```console
codex mcp add sitelemetry --url https://sitelemetry.com/mcp
codex mcp login sitelemetry
```

```console
claude mcp add --transport http sitelemetry https://sitelemetry.com/mcp
claude mcp login sitelemetry
```

Other Streamable HTTP clients can use this source-free configuration:

```json
{
  "mcpServers": {
    "sitelemetry": {
      "type": "streamable-http",
      "url": "https://sitelemetry.com/mcp"
    }
  }
}
```

Installing the Sitelemetry plugin itself registers both Cloud and Local Agent
transports. Do not install a second local package or check out the private
repository.

## Example prompts

- Audit my verified website and prioritize the most urgent fixes.
- Audit my local development site, apply safe fixes, and show the verified before/after result.
- Find my running localhost site and perform a full audit.

## Local Agent trust boundary

The public plugin contains the reviewable launcher, integration metadata,
documentation, skill, and presentation assets. It does not contain the
proprietary Sitelemetry application or audit-engine source.

Before every local execution, the launcher verifies Sitelemetry's signed
release manifest and the selected platform binary's declared size and SHA-256
digest. It accepts releases only from the pinned `https://sitelemetry.com`
origin, does not follow download redirects, and fails closed when verification
cannot be completed. The Local Agent itself sends no site data to Sitelemetry
Cloud. Audit requests and results return to the MCP client and may be processed
by the client's model provider under the user's client/provider settings.

Documentation: <https://sitelemetry.com/mcp-guide>

Support: <support@sitelemetry.com>
