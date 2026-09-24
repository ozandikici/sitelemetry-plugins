# Sitelemetry plugins

This public distribution contains the Sitelemetry integration surface only:
the Codex, Claude Code, and Cursor plugin manifests, Gemini CLI extension,
Local Agent launcher, audit skill, documentation, and brand assets. Sitelemetry's proprietary application and
audit-engine source are not part of this repository.

Codex and Claude Code package version: `0.4.2`

## Connect in Cursor

The [Cursor plugin](plugins/sitelemetry-cursor/README.md) connects to Sitelemetry
Cloud using OAuth. It provides seven website audit tools through the
`https://sitelemetry.com/mcp` endpoint. See the
[Cursor setup guide](docs/cursor.md) for manual MCP configuration.

## Connect in Gemini CLI

The [Gemini CLI extension](docs/gemini-cli.md) connects to Sitelemetry Cloud
through the general OAuth endpoint. It installs one remote MCP server and no
local executable. See the guide for installation and browser authentication.

## Install in Codex

macOS, Linux, or Git Bash:

```console
codex plugin marketplace add ozandikici/sitelemetry-plugins && codex plugin add sitelemetry@sitelemetry
```

Windows PowerShell:

```powershell
codex plugin marketplace add ozandikici/sitelemetry-plugins; if ($LASTEXITCODE -eq 0) { codex plugin add sitelemetry@sitelemetry }
```

Start a new Codex task after installation so the plugin's skill and MCP
servers are loaded.

## Install in Claude Code

macOS, Linux, or Git Bash:

```console
claude plugin marketplace add ozandikici/sitelemetry-plugins && claude plugin install sitelemetry@sitelemetry
```

Windows PowerShell:

```powershell
claude plugin marketplace add ozandikici/sitelemetry-plugins; if ($LASTEXITCODE -eq 0) { claude plugin install sitelemetry@sitelemetry }
```

Open `/mcp` inside Claude Code, select the Sitelemetry server and choose
**Authenticate** to complete browser sign-in and approval.

## What the Codex and Claude Code plugin installs

- `sitelemetry`: the OAuth-protected Sitelemetry Cloud MCP server for production
  websites, using the general OAuth endpoint.
- `sitelemetry-local`: a loopback-only Local Agent for `localhost`,
  `127.0.0.1`, and `::1` development sites.
- `local-web-audit`: the audit, safe-fix, re-test, and before/after workflow.

Codex and Claude Code connect to `https://sitelemetry.com/mcp`. Public audits
can use public targets; protected security modules and Full Audit require
workspace ownership verification. Claude.ai's Directory connection is
documented separately. See the
[client setup guide](https://sitelemetry.com/mcp-guide) for verification and
account requirements.

The Local Agent launcher downloads only the exact platform binary declared by
Sitelemetry's signed release manifest. It verifies the manifest's Ed25519
signature plus the binary's size and SHA-256 digest before execution. The
Local Agent sends no site data to Sitelemetry Cloud. Audit requests and results
return to the MCP client and may be processed by its model provider under the
user's client/provider settings.

Documentation: <https://sitelemetry.com/mcp-guide>

Privacy: <https://sitelemetry.com/privacy>

Terms: <https://sitelemetry.com/terms>

## License

The files in this repository are licensed under the [MIT license](LICENSE).
Sitelemetry names and logos remain trademarks of their owner. The license does
not cover the remote Sitelemetry service, the signed Local Agent binary that the
launcher downloads, or Sitelemetry's proprietary application and audit-engine
source, none of which are part of this repository.
