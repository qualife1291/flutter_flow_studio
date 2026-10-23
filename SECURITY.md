# Security

The server binds to loopback by default. `--host 0.0.0.0` explicitly exposes it to your network. Use a trusted development network and firewall. The built-in server does not provide TLS; do not expose it to the public Internet. Use a TLS reverse proxy for remote or HTTPS web sessions.

Graph and WebSocket endpoints require a random per-process 256-bit token. The UI shell and `/health` are public. Tokens remain in UI memory, not local storage. Browser WebSocket authentication uses a query parameter; reverse proxy access logs must omit query strings. Do not share terminal logs containing a live token.

The runtime and server strip URL credentials, query strings and fragments and exclude request/response bodies and custom payloads. Headers, cookies and route arguments are not captured. A user-authored snapshot can contain bodies; exporting those requires explicit confirmation. Graphs and snapshots now include complete enclosing functions/classes as deduplicated source contexts, as well as snippets and endpoint literals. This source may contain hardcoded secrets; body redaction does not remove secrets embedded in code. Review snapshots, screenshots and graphs before sharing. Redaction is not a substitute for keeping secrets out of application source.

Runtime is opt-in and guarded by `kReleaseMode`. It creates no transport in release. No telemetry or third-party analytics is sent by this package. The example's API adapter is in process. The runtime event queue, server history and session registry are bounded. Invalid events are rejected and do not execute code. HTTP certificate validation is inherited from the app; this package never bypasses it.

Deep trace changes source files only when explicitly requested and keeps backups. It refuses to overwrite files edited during tracing. Stop the CLI normally to restore; after a hard kill, recover from the backup directory before another tracing session.

Report security problems privately to the repository owner through GitHub's available private reporting channel; do not include credentials in public issues.
