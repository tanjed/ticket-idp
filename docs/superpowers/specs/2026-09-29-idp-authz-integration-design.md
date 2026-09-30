# IdP integration with Authz

Date: 2026-09-29. Status: approved in brainstorming; built in this round.

System overview: `../Authz/docs/superpowers/specs/2026-09-29-authz-service-design.md`.

## 1. Client type

Each Hydra client carries `metadata.user_type`: `provider` or `consumer`. `/oauth/login` reads it from the login request and pins it in the context cookie (`ut`). A missing or unknown value is treated as `consumer`, the least-privileged type (consumer tokens carry no company or roles). `make add-client USER_TYPE=provider|consumer`.

## 2. Login

`finishLogin` (after password and phone checks):
- consumer: unchanged.
- provider: `GET {AUTHZ_INTERNAL_URL}/internal/v1/subjects/{sub}/claims`.
  - 200: accept the login.
  - 404 (not a member of any company): redirect to `/company`, the company onboarding page.
  - 403 (company suspended): "Your company's access is suspended."
  - anything else: "Sign-in is unavailable. Please try again." Never a provider login without claims.

## 3. Company onboarding (`/company`)

Behind the context cookie like every auth page (proxy matcher, page guard, POST guard), and only with `ctx.sub` set by a completed login. Form: company name. Submit: `POST /internal/v1/companies {name, admin_sub}` (idempotent), then `finishLogin`. Provider registration is the normal registration flow; the company step follows the phone OTP.

## 4. Consent and claims

Consent reads `consent.client.metadata.user_type`:
- consumer: access token gets `user_type: "consumer"`.
- provider: fetch claims again (fresh); access token gets `user_type: "provider"`, `company_id`, `roles` (`[{id, name, version}]`). A 404 or 403 rejects the consent (`access_denied`): a remembered login cannot mint a provider token for someone who has left the company.

`oauth2.allowed_top_level_claims` gains `user_type`, `company_id`, `roles` (invariant 9).

## 5. Staff invitations

- `GET /api/internal/identities?phone=` → `{id}` or 404. Called by Authz before creating an invitation.
- `POST /api/internal/invitations {invitation_id, phone, company_name, expires_at}` → signs an invite token (`INVITE_TOKEN_SECRET`, HMAC, carries `invitation_id`, `phone`, `exp`) and publishes `USER_INVITED {phone, company_name, invite_url}` (the notification service sends the SMS). In dev (`DEV_LOG_EMAIL_LINKS`) the link is also logged.
- Both refuse requests addressed to the public host, like the Kratos webhook; the ingress never routes `/api/internal/*`.
- `/invite?token=`: a landing page like `/verify-email` (no context cookie: it is reached from an SMS, not from a Hydra login). It verifies the token, reads the invitation from Authz, and:
  - existing identity for that phone: a "Join <company>" button;
  - otherwise: first name, last name, email, password.
- `POST /invite/submit`: re-verifies the token (and the Origin header). New person: creates the Kratos identity through the admin API with the phone already verified (they received the SMS) and the password; publishes `USER_REGISTERED`. Then `POST /internal/v1/invitations/{id}/accept {sub}`. Shows "You have joined <company>. Sign in through your app."
  - If accept fails after a new identity was created, the identity stays (it can sign in as a consumer); the page reports the failure.

## 6. Configuration

New env: `AUTHZ_INTERNAL_URL`, `INVITE_TOKEN_SECRET`. Chart values and a pre-created secret key for the latter.

## 7. Documentation changes

AGENTS.md: invariant 9 claim list; events list gains `USER_INVITED`; `/api/internal/*` joins the webhook as internal-only; `/invite` joins `/verify-email` as the pages reachable without the context cookie; `/company` is a gated auth page.
