# Connect Sitelemetry in Cursor

The Cursor plugin connects one remote Sitelemetry Cloud MCP server. See the
[plugin documentation](../plugins/sitelemetry-cursor/README.md) for the tools,
account requirements, and data handling.

## Manual MCP setup

You can also add the following to Cursor's MCP configuration:

```json
{
  "mcpServers": {
    "sitelemetry": {
      "url": "https://sitelemetry.com/mcp"
    }
  }
}
```

Use Cursor's authentication control for Sitelemetry to complete browser
sign-in and approval. Keep the `/mcp` URL for this integration. Do not put
passwords, tokens, or authorization headers in the configuration.

The browser connection offers free account creation. Available audit kinds
and usage limits reflect the access already assigned to the connected account.
Target verification may be required for protected checks. The configuration
runs no audits on installation. Tool calls follow your Cursor permissions.

If the connection fails, confirm that the URL matches exactly, then use Cursor's
authentication control again. Contact
[support@sitelemetry.com](mailto:support@sitelemetry.com) with the error message
and Cursor version; omit passwords and tokens.

Cursor's [MCP documentation](https://cursor.com/docs/mcp) explains its MCP
settings and authentication controls. The plugin index is
[.cursor-plugin/marketplace.json](../.cursor-plugin/marketplace.json).

This document and the Cursor plugin index use the
[Cursor integration's MIT license](../plugins/sitelemetry-cursor/LICENSE).
