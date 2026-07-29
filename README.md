# Sitelemetry plugins

This public distribution contains the Sitelemetry integration surface only:
the Codex and Claude Code plugin manifests, Local Agent launcher, audit skill,
documentation, and brand assets. Sitelemetry's proprietary application and
audit-engine source are not part of this repository.

Version: `0.4.0`

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

## What one plugin installs

- `sitelemetry`: the OAuth-protected Sitelemetry Cloud MCP server for public
  and verified production targets.
- `sitelemetry-local`: a loopback-only Local Agent for `localhost`,
  `127.0.0.1`, and `::1` development sites.
- `local-web-audit`: the audit, safe-fix, re-test, and before/after workflow.

The Local Agent launcher downloads only the exact platform binary declared by
Sitelemetry's signed release manifest. It verifies the manifest's Ed25519
signature plus the binary's size and SHA-256 digest before execution. The
Local Agent sends no site data to Sitelemetry Cloud. Audit requests and results
return to the MCP client and may be processed by its model provider under the
user's client/provider settings.

Documentation: <https://sitelemetry.com/mcp-guide>

Privacy: <https://sitelemetry.com/privacy>

Terms: <https://sitelemetry.com/terms>
