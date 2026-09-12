# Sitelemetry for Gemini CLI

<img src="../plugins/sitelemetry/assets/sitelemetry-logo-1024.png" alt="Sitelemetry" width="96" height="96">

Connect Gemini CLI to Sitelemetry's hosted website-audit service using browser
sign-in. The extension exposes the general remote MCP endpoint at
`https://sitelemetry.com/mcp`. It requires no API key, local server, shell hook,
or downloaded audit-engine binary.

## Install

Install [Gemini CLI](https://geminicli.com/docs/get-started/installation/) and run:

```console
gemini extensions install https://github.com/ozandikici/sitelemetry-plugins
```

Restart Gemini CLI after installation. In the interactive CLI:

```text
/mcp auth sitelemetry
```

Complete Sitelemetry sign-in or account creation in the browser, review the
requested access, and approve the connection. The browser returns to Gemini
CLI's local callback. Run `/mcp` to inspect the connection and available tools.
Your browser must be able to reach the local callback; an SSH session or
headless environment without browser access may require a different setup.

An existing manual MCP configuration named `sitelemetry` takes precedence over
this extension's server definition. If one is already configured, review it
before adding another installation.

## What it does

Sitelemetry provides website security, technical SEO, AI visibility, integration,
accessibility and performance audits, plus a combined full audit. Results
contain the available findings, supporting evidence and remediation guidance.
Long-running audits return a job that the client can poll for completion.

Examples to adapt to a website you are authorized to assess:

- "Audit my website's technical SEO and explain the evidence for each issue."
- "Run a full audit of my verified website and prioritize the fixes."
- "Check the completed audit job and show the findings and coverage limits."

A Sitelemetry account is required. Free and paid accounts retain their own
module access and usage limits. Protected security modules and Full Audit
require domain ownership verification in the connected workspace. Installing
this extension does not verify a domain or grant additional scan credits.

Read each result's scope and coverage: an audit can complete while some
measurements are partial or unavailable. AI visibility assesses content
readiness; it does not claim live answers or citation share across AI services.
This remote-only Gemini extension does not install the separate Sitelemetry
Local Agent bundled with the Codex and Claude Code plugins in this repository.

## Update or remove

```console
gemini extensions update sitelemetry
gemini extensions uninstall sitelemetry
```

You can also revoke an individual MCP connection in your Sitelemetry account.
Audit targets and requests are processed by Sitelemetry Cloud; audit results
are returned to Gemini CLI and may be processed under your Google/client
settings. This repository contains distribution files and documentation;
Sitelemetry's hosted application and audit-engine source remain private.

- [Setup and account requirements](https://sitelemetry.com/mcp-guide)
- [Access information](https://sitelemetry.com/access-information)
- [Privacy](https://sitelemetry.com/privacy)
- [Terms](https://sitelemetry.com/terms)
- [Support](https://sitelemetry.com/support) or support@sitelemetry.com

The extension is published by Sitelemetry. Gemini CLI is a Google product;
this integration does not imply Google endorsement.
