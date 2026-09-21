# Installing the Sitelemetry MCP server (guide for AI agents)

Sitelemetry is a hosted (remote) MCP server. There is nothing to clone, build or run
locally: the client connects to `https://sitelemetry.com/mcp` over Streamable HTTP and
signs in with browser OAuth (PKCE, dynamic client registration). A free Sitelemetry
account is created during the first sign-in if the user does not have one.

Audit only websites the user owns or is explicitly authorized to test.

## 1. Clients with native remote MCP + OAuth support

Add the server by URL. Example configuration (Cline, Cursor, Claude Code, Codex, Gemini CLI
and other clients that accept a `url` entry):

```json
{
  "mcpServers": {
    "sitelemetry": {
      "type": "streamableHttp",
      "url": "https://sitelemetry.com/mcp"
    }
  }
}
```

Field names differ slightly between clients (`type` may be `streamable-http` or `http`,
some clients use `serverUrl`). On the first tool call the client opens the Sitelemetry
sign-in page in the browser; approve access and the connection is stored.

Client-specific commands:

- Claude Code: `claude mcp add --transport http sitelemetry https://sitelemetry.com/mcp`
- Codex: `codex mcp add sitelemetry --url https://sitelemetry.com/mcp` then `codex mcp login sitelemetry`
- Gemini CLI: `gemini extensions install https://github.com/ozandikici/sitelemetry-plugins`

## 2. Clients without OAuth support for remote servers

Use the `mcp-remote` bridge, which runs locally and performs the browser sign-in:

```json
{
  "mcpServers": {
    "sitelemetry": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://sitelemetry.com/mcp"]
    }
  }
}
```

Requires Node.js 18 or newer. No API key is needed for either method.

## 3. Verify the installation

List the tools: the server exposes seven `audit_*` tools (`audit_security`, `audit_seo`,
`audit_ai_visibility`, `audit_integrations`, `audit_accessibility`, `audit_performance`,
`audit_full`). Then call `audit_security` with `{"target": "https://example.com"}` for a
site the user owns. Long audits return `status: "running"` with `pollArguments`; call the
same tool again with exactly those arguments until the final result arrives.

## 4. Optional API key (CI and automation)

Signed-in users can copy an MCP API key from https://sitelemetry.com/app (MCP section) and
send it as `Authorization: Bearer <key>` instead of OAuth. This is used by the Sitelemetry
GitHub Action and GitLab component, not needed for interactive clients.

## Troubleshooting

- `401` with a `WWW-Authenticate` challenge before sign-in is expected; it is how the client
  discovers the OAuth server.
- Free accounts run public security checks on unverified targets; verify domain ownership in
  https://sitelemetry.com/app (DNS or HTTP challenge) to unlock the protected checks.
- Setup guide with screenshots: https://sitelemetry.com/mcp-guide
