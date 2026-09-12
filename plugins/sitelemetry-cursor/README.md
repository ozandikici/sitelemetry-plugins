# Sitelemetry for Cursor

Connect Cursor to Sitelemetry Cloud to inspect a public website and discuss
the resulting findings in your conversation.

This plugin provides seven tools:

- `audit_security`
- `audit_seo`
- `audit_ai_visibility`
- `audit_integrations`
- `audit_accessibility`
- `audit_performance`
- `audit_full`

## Connect

After installing the plugin, enable the Sitelemetry MCP server in Cursor and
complete the browser sign-in and authorization. You can create a free
Sitelemetry account from that connection flow. No API key is required.

Ask, for example: "Audit the SEO of https://example.com and explain the most
useful changes." Review the requested tool and target before allowing an audit.

Available audits and usage limits reflect the access already assigned to the
connected account. Audits consume that account's usage allowance. Some checks
require verified control of the target; the server returns the required step
when access or verification is missing. For account access information, see
[Sitelemetry account access](https://sitelemetry.com/access-information).

## Data and scope

The plugin connects to `https://sitelemetry.com/mcp/v2` over HTTPS using OAuth.
It sends requested target URLs and audit options to Sitelemetry Cloud. Audit
requests and results are returned to Cursor and may be processed by its model
provider under your Cursor settings. It installs no local executable, hooks,
or automatic scans, and it does not audit localhost or private network targets.

Review the [privacy policy](https://sitelemetry.com/privacy) and
[service terms](https://sitelemetry.com/terms). Contact
[support@sitelemetry.com](mailto:support@sitelemetry.com) for connection help.

## License

The Cursor configuration and documentation are licensed under the included
[MIT license](LICENSE). Sitelemetry names and logos remain trademarks of their
owner. This license does not license the remote Sitelemetry service or other
integrations in this repository.
