# AGENTS.md — frontend apps

Applies to `web-app` and `shared-ui`.

**Architecture note (ADR-0002):** this used to be 3 separate apps
(`contractor-app`, `customer-app`, `resource-owner-app`). It's now one
app, `web-app`, with a single register/login flow and role-based
dashboard routing inside it. Those 3 folders still exist (marked
DEPRECATED.md) for reference but should not receive new work.

- Never call a service directly — always through the gateway
  (`infra/gateway/`), so auth and routing stay centralized.
- Any API call from `web-app` must match a path that actually exists in
  `packages/contracts/openapi/*.yaml`. If a field or endpoint isn't there,
  it doesn't exist yet — don't build UI against an assumed shape.
- UI lives in `web-app/src/pages/<role>/*` (one file per screen) with
  shared pieces in `web-app/src/components/*` and session/data helpers in
  `web-app/src/lib/*`. The old `src/dashboards/*.jsx` files are gone -
  see `docs/adr/0005-field-console-ui.md`.
- Colours, type, spacing and the domain display helpers (stage labels,
  phase grouping, INR formatting) come from `shared-ui/src/tokens.js`.
  Don't hand-write hex values or re-label job stages in a screen.
- `shared-ui` is the only place for cross-app components — even with one
  app today, keep using it, not `web-app/src` directly, for anything that
  isn't presentation (auth calls, JWT decoding, API clients). A second app
  may exist again later (ADR-0002 doesn't rule it out); code placed
  correctly now doesn't need to move later.
- Role selection happens ONCE, at registration (`RegisterAccount`'s `role`
  field). Login never asks for role again — it's returned automatically
  by platform-spine and decoded from the JWT. Don't add a role picker to
  the login form; that would contradict the explicit product decision in
  ADR-0002.
- Client-side role routing (which dashboard renders) is presentation only,
  never the security boundary. That's enforced server-side by each
  service's `require_role()` and proven by that service's isolation tests
  — don't add client-side checks that imply otherwise.
