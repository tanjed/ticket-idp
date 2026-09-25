# Contributing to IdP

Read `AGENTS.md` first: it lists the rules that must not be broken (Kratos stays private, no token for an unverified phone, one events topic, config written once) and the gotchas that have already cost time.

## Setup

```sh
make network                    # once: the shared docker network
helm dependency build chart     # once per clone: fetches the Hydra and Kratos subcharts
cd ui && npm install            # UI dependencies
docker compose up -d --build    # the local stack
```

To exercise a real sign-in, run `../TestClient` (a separate repo) and open <http://localhost:3002>. The local phone OTP is `123456`.

## Workflow

1. Branch from `main`.
2. Make the change, keeping it focused. A refactor and a behaviour change belong in separate pull requests.
3. Check it (below).
4. Open a pull request and fill in the template. Say what you could not run.

Commit messages use a type prefix, as in the history: `feat:`, `fix:`, `chore:`.

## Checking a change

There is no CI and no automated test suite yet, so a change is checked by hand. Do all that apply and say so in the PR:

| Changed | Run |
|---|---|
| `ui/` | `cd ui && npx tsc --noEmit && npm run build` |
| `chart/`, `helmvars/` | `make lint template` |
| `chart/config/` | Restart with `docker compose restart kratos idp-hydra` and confirm both come up. If you touched `selfservice.yaml`, `courier.yaml` or a `webhooks/*.jsonnet`, run a signup and check the events (below) |
| Any flow (login, signup, OTP, recovery, email) | Walk the flow through `../TestClient` and check the events it should fire reach `idp.events` |

To read the events locally:

```sh
docker exec bus-idp-idp-kafka-1 rpk topic consume idp.events -o start -f '%v\n' -X brokers=idp-kafka:9092
```

Adding tests is very welcome; if you add the first ones, wire them into a `make` target and update this file and the PR template.

## Changing the Ory config

The config in `chart/config/` is the only copy, used as is by docker-compose (bind mount) and the chart (ConfigMap). So:

- Do not duplicate a file or a value into docker-compose or `chart/values.yaml`, and do not add placeholders or a render step. If a value differs per environment, set it outside the file: Hydra's env vars in `docker-compose.yaml`, `helmvars/` in the chart.
- Kratos calls the UI at `http://idp-ui:3001`. Keep that name and port the same in docker-compose and the chart (the chart's UI Service listens on 3001).
- Config is read at startup: restart the service after editing (`docker compose restart kratos idp-hydra`; restart the pod in a cluster).
- Hydra silently drops any custom JWT claim not in `allowed_top_level_claims`: list every claim the UI adds at consent.

## Adding or changing an event

Events are the contract with the notification service and anything else that consumes `idp.events`.

1. Add the name to `EVENTS` in `ui/lib/events.ts`.
2. Publish it with `publishEvent` from the UI, **or**, if Kratos is the source, add a `chart/config/kratos/<name>.jsonnet` body template and a hook in `selfservice.yaml`. The Kratos-originated ones all go through the one webhook route.
3. Keep the payload small and free of secrets. It may carry a one-time code where the consumer must send it (OTP, recovery), and nothing else sensitive.
4. Document it in the README's event table.

Changing an existing event's shape can break consumers: add fields, do not rename or remove them.

## Changing the identity schema

`chart/config/kratos/identity.default.schema.json` is shared by docker-compose and the chart. Existing identities are already stored: a stricter schema can make them invalid. Check that a signup, a login and a recovery still work, and say how existing data is affected.

## Deployment changes

- The chart never creates secrets: add new ones to the README's table and to `AGENTS.md` if needed.
- Subchart values cannot be templated, so Hydra's per-environment URLs are literals in `helmvars/*.yaml`: they must match `domain`.
- Keep `helmvars/*.yaml` minimal: a new setting gets a default in `values.yaml` and is derived where possible.
- Nothing `DEV_*` may reach the chart or `helmvars/`.
- The Traefik and cluster policy live in `../Traefik`.

## Security

This service handles credentials, so please be careful:

- Never log secrets, one-time codes or tokens, and never put them in events except where the consumer must deliver a code.
- Login and recovery errors must never reveal whether an account exists.
- Do not expose Kratos, and do not add a path to its flows that skips the context cookie.
- Do not accept a return URL from a request; use the client's registered redirect URI.
- Report suspected vulnerabilities privately to the maintainers rather than in a public issue.

## Pull requests

`.github/pull_request_template.md` is filled in automatically when you open a pull request. Complete every section, and tick or strike each checklist item. `.github/CODEOWNERS` requests review from the owners of the paths you touch.
