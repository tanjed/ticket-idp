## What and why

<!-- What does this change, and why? Link the issue or task. -->

## Changes

-

## Testing

There is no CI or automated suite yet, so say what you ran.

- [ ] `ui/` changed: `cd ui && npx tsc --noEmit && npm run build` pass
- [ ] `chart/` or `helmvars/` changed: `make lint template` pass
- [ ] `chart/config/` changed: services restarted and healthy (`docker compose restart kratos idp-hydra`)
- [ ] A flow changed (login, signup, OTP, recovery, email): walked through `../TestClient`, and the expected events reached `idp.events`
- [ ] Anything not run locally is listed below

<!-- Note what you could not run. -->

## Checklist

- [ ] Ory config changed: edited only `chart/config/` (no copy in docker-compose or chart values, no templating); anything per-environment is set in docker-compose env and `helmvars/`
- [ ] Event added or changed: `EVENTS` list and the README event table updated; existing fields not renamed or removed
- [ ] Identity schema changed: existing identities still valid; signup, login and recovery still work
- [ ] New Secret or environment variable: documented in the README; the chart still creates no secrets
- [ ] JWT claims changed: every claim the UI adds at consent is listed in `allowed_top_level_claims`
- [ ] No `DEV_*` setting in the chart or `helmvars/`
- [ ] `AGENTS.md` / `README.md` updated if commands, layout, invariants or status changed

## Security

- [ ] Kratos is still not published or routed, and every auth page and POST still requires the context cookie
- [ ] No token is issued for an unverified phone
- [ ] No secrets, one-time codes or tokens in code or logs (a code only in the event that must deliver it)
- [ ] Errors do not reveal whether an account exists
- [ ] No return URL taken from a request
- [ ] None of the invariants in `AGENTS.md` are broken (or the change is explained above)
