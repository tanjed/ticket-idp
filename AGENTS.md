# AGENTS.md: IdP

Guide for AI agents and humans working in this repo.

## What this is

The Bus 2.0 identity provider: Ory Hydra (OAuth2 / OIDC, JWT access tokens), a **private** Ory Kratos (identities and credentials), and a Next.js UI (`ui/`) that is Hydra's login / consent / logout handler and the only client of Kratos. The UI also publishes every user event to Kafka. Apps sign in through Hydra; they never see Kratos. For provider clients the UI asks `../Authz` for the user's company and roles and puts them in the token; the `../APISIX` gateway authorizes requests from those claims.

## Commands (run from `IdP/`)

| Command | Purpose |
|---|---|
| `make network` | Create the shared `shohoz` docker network (once) |
| `docker compose up -d --build` | Local stack: Postgres, Hydra, Kratos, Kafka (Redpanda), the UI |
| `docker compose restart kratos idp-hydra` | Pick up edits to `chart/config/` (config is rendered at container start) |
| `make lint` / `make template` | `helm lint` / `helm template` for every `helmvars/*.yaml` |
| `helm dependency build chart` | Fetch the Hydra and Kratos subcharts (needed after cloning) |
| `make add-client` | Create or update an OAuth2 client in Hydra |
| `cd ui && npm install` | Install UI dependencies |
| `cd ui && npx tsc --noEmit` | Typecheck the UI |
| `cd ui && npm run build` | Production build of the UI |

There is no `make verify` yet: see Status.

## Layout

- `ui/app/oauth/{login,consent,logout}`: Hydra's three handlers. `login` validates the challenge and pins it to the browser (encrypted cookie); `consent` grants and adds claims; `logout` ends the Hydra session.
- `ui/app/{login,registration,verification,recovery,settings}`: the pages. Each has a `submit/route.ts` that takes the form POST.
- `ui/app/api/webhooks/kratos`: the **single** webhook Kratos calls (hooks and courier). It authenticates, validates the event name and passes it to Kafka.
- `ui/app/api/email-verification/{send,status}`: bearer-token API for client apps.
- `ui/app/company`: company onboarding (a gated auth page): a provider login by someone in no company lands here (`ctx.co`).
- `ui/app/invite`: the staff invitation link's landing page (no context cookie, like `verify-email`): create the account or join.
- `ui/app/api/internal/{identities,invitations}`: called by Authz only (identity lookup by phone, send an invitation). Internal like the webhook.
- `ui/lib/authz.ts`: `AuthzClient`, Authz's internal REST client. `ui/lib/invite-token.ts`: `InviteTokens`, the signed invite link.
- `ui/app/verify-email`: the emailed link's landing page. `ui/app/signed-out`: where Hydra lands after a logout (`urls.post_logout_redirect`); redirects to `UI_FALLBACK_URL` if set.
- `ui/proxy.ts`: gates the auth pages (403 rewrite to `ui/app/blocked`). `ui/components/status-page.tsx`: the standard full-page message (icon, title, text, optional button) used for every status screen; new ones should use it. `ui/components/blocked.tsx` is the "can't be opened directly" screen; with `UI_FALLBACK_URL` set (`Config.fallbackUrl`, http/https only) the proxy and that component redirect there instead.
- **Class based, tsyringe DI.** Services are `@singleton()` classes with constructor injection (always an explicit `@inject(Class)` per parameter: the build does not rely on emitted type metadata). Decorators and `container` come from `ui/lib/di.ts` only (it loads `reflect-metadata` first). Route files are one line, `export const POST = (req) => container.resolve(XController).method(req)`; pages call `container.resolve(Service)`. Pure mappers (`fieldMessages`, `copy`, `claimsFor`, `userType`, `csrfOf`) stay functions; client components import only those and types, never the container.
- `ui/lib/config.ts`: `Config`, the environment (secrets read on first use). `ui/lib/ctx.ts` / `ctx-cookie.ts`: `ContextStore` and `CookieCipher`, the encrypted context cookie. `ui/lib/kratos-api.ts`: `KratosPublic` (API-mode flows). `ui/lib/identity.ts`: `KratosAdmin`. `ui/lib/kratos-browser.ts`: `KratosBrowser`, recovery only (see gotchas). `ui/lib/events.ts`: `EventPublisher`, the only Kafka producer. `ui/lib/hydra.ts`: `HydraAdmin`. `ui/lib/handlers.ts`: `FlowResponder`, shared POST helpers. `ui/lib/login.ts`: `LoginService.finish`. `ui/lib/signed-token.ts`: the base of `EmailTokens` and `InviteTokens`. `ui/lib/controllers/`: one controller per route group. `ui/lib/messages.ts`: our wording for Kratos messages, keyed by message id.
- `chart/`: Helm chart. `chart/config/`: Ory config shared with docker-compose. `chart/templates/`: one file per resource. `helmvars/`: per-environment values.

## Invariants (do not break)

1. **Kratos is private.** Only the UI reaches it. Never publish ports 4433/4434, never route them through an ingress, and keep `chart/templates/kratos-networkpolicy.yaml`. No browser talks to Kratos.
2. **Every auth page and POST needs the encrypted context cookie** that `/oauth/login` sets after Hydra validates a `login_challenge`. Without it they refuse (403): `ui/proxy.ts` redirects GETs for the auth pages to `UI_FALLBACK_URL`, or answers a real 403 with the standard `/blocked` page when it is unset, each page guards itself again, and POST handlers check it too. Do not add a way to reach Kratos flows without one.
3. **No token for an unverified phone.** `LoginService.finish` re-checks `phoneVerified` before accepting the Hydra login. Signup and login both go through the OTP.
4. **Kratos sessions are throwaway.** The UI revokes each one as soon as Hydra accepts the login. Hydra's own session is the only SSO. (Recovery briefly holds a Kratos cookie jar inside the encrypted cookie, then ends it.)
5. **One events topic, one publisher (for the IdP).** Events go to `idp.events` through `EventPublisher` in `ui/lib/events.ts`, and Kratos-originated ones arrive through the single webhook. Do not add other HTTP notification calls or other topics without agreeing the event contract first. Event names are the `EVENTS` list.
6. **The webhook is internal and must fail loudly.** It is only a bridge from Kratos to Kafka. It has no check of its own: being unreachable from outside is the ingress's job, so the ingress must never route `/api/webhooks/*` (nor `/api/internal/*`, Authz's endpoints, which additionally refuse the public host). It returns 400 for an unknown event and 5xx when Kafka is down (so Kratos' courier retries). A courier message with no event (`event: null` from its jsonnet) is acknowledged and dropped, never retried. Each courier message needs a jsonnet body (the sms channel refuses to send without one, and Kratos' default payload has no identity); keep only whitelisted fields in it, since the raw message carries the whole identity and request headers.
7. **Ory config is written once**, in `chart/config/`, and used as is: docker-compose bind-mounts it, the chart puts it in a ConfigMap. Do not copy a config file into another folder or into chart values, and do not add templating or a render step: keep the files free of anything environment-specific. Per-environment values go in Hydra's env vars (`docker-compose.yaml`) and `helmvars/`. Kratos' service URLs are fixed strings (`http://idp-ui:3001/...`), so the chart's UI Service must stay on port 3001.
8. **The chart never creates secrets.** They are pre-created (see README).
9. **Hydra silently drops custom JWT claims** not in `oauth2.allowed_top_level_claims` (`chart/config/hydra/hydra.yaml`). Any claim the UI adds at consent (today `email_verified`, `phone_number_verified`, `user_type`, `company_id`, `roles`) must be listed there. There is no token hook: the JWT holds only what the consent step puts in it, so role changes reach a user's token at their next login, not at refresh.
14. **The client decides the user type**, never the claims present. `userType()` in `ui/lib/hydra.ts`: `metadata.user_type == "provider"`, anything else is a consumer (least privilege). A provider token is issued only with fresh claims from Authz (at login in `LoginService.finish` and again at consent); if Authz says no company, suspended, or is unreachable, there is no provider token.
10. **Errors never reveal whether an account exists.** Wrong login is always "Invalid Mobile/Password"; password recovery answers the same for unknown emails.
11. **No caller-supplied return URLs.** After email verification the user goes to the client's *registered* redirect URI, looked up in Hydra by the client id in the signed token.
12. **The `DEV_*` switches are local only** (`DEV_STATIC_OTP`, `DEV_LOG_EMAIL_LINKS`). They live in `docker-compose.yaml` and must never appear in the chart or `helmvars/`.
13. **API bearer tokens are verified as JWTs** (signature via Hydra's JWKS, `iss`, `exp`, `aud`, RS256). Do not add an introspection or "trust the header" path.

## Gotchas

- Kratos reads its config at startup. After editing `chart/config/`, restart the service (compose) or the pod (cluster: the chart cannot hash the config into pod annotations).
- Do not use `forbidden()` / `notFound()` for these screens: the status is right but the HTML body is empty (the message only arrives through JavaScript), so people without JS and crawlers see a blank page. Rewrite in `proxy.ts` instead.
- Kratos' courier only runs with `--watch-courier`. Without it OTP and recovery messages queue forever (and the dev OTP shim, which reads that queue, hides the problem).
- Kratos cannot resend an SMS from a verification flow. "Send a new OTP" makes the user log in again, which triggers a fresh code.
- API-mode recovery cannot finish (no session comes back), so recovery runs as a server-side browser session (`ui/lib/kratos-browser.ts`).
- Kratos hooks are fire-and-forget: a hook event is lost if the UI or Kafka is down at that moment. Only courier events (OTP, recovery code) are retried.
- The webhook has no shared secret and no host check: it relies entirely on not being routed by the ingress. Do not expose the UI's port to anything that should not be able to inject events.
- Every compose service runs on the external `shohoz` network (`make network`), shared with the other repos here. Docker DNS treats a service name as an alias on every network, so names must stay unique across those repos: `idp-hydra`, `idp-ui` and `idp-kafka` are prefixed for that reason, but `postgres`, `kratos` and the two `*-migrate` services are generic. Prefix them if another repo on `shohoz` ever uses the same name. Locally, that also means any container on `shohoz` can reach Kratos; only the chart's NetworkPolicy enforces "only the UI" for real.
- Subchart values cannot be templated, so Hydra's per-environment URLs are literals in `helmvars/*.yaml` (they must match `domain`).

## Status: what is and is not built

Built and verified by hand (end to end against the real stack, and with real Kratos and Hydra containers started on the config the chart renders): register, phone OTP, login, unverified login, forgot / reset password, email verification link, the bearer-token API (JWT verification, CORS, rate limit), SSO and logout through Hydra, all eight events reaching Kafka, and the same config files running under docker-compose and, as ConfigMap contents, under a real Kratos and Hydra.

**Not built or not verified:**

- **No automated tests.** The `ui/` has no test suite and there is no CI. Verification so far is manual (curl-driven flows), not repeatable.
- The chart has never been installed on a cluster. It lints and renders, and Kratos and Hydra start on the rendered config, but nothing has run under Kubernetes. The NetworkPolicy needs a CNI that enforces it.
- `helmvars/` UI image and Kafka brokers are placeholders.
- The notification service that consumes `idp.events` is not in this repo.
- Login does not yet require a verified email (only the phone).
- The API rate limit is in memory (one instance).
- Identities created through Kratos' admin API fire no events (the invite flow publishes `USER_REGISTERED` itself).
- Provider claims are copied into refreshed tokens by Hydra: role changes apply at the next login (no `token_hook` yet).
- The consumers/providers split, `/company` and `/invite` are typechecked but not yet run end to end.
- Consent is granted automatically for every client (fine for first-party apps only).

## Conventions

- Match the surrounding code's style and comment density. Comments explain *why*; the UI is TypeScript with no extra formatter configured.
- Never commit secrets. Dev secrets in `docker-compose.yaml` are placeholders for local use only.
- Commit messages use a type prefix, as in the history: `feat:`, `fix:`, `chore:`.
