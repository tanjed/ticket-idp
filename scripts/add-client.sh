#!/usr/bin/env bash
# Creates or updates an OAuth2 client in Hydra. Idempotent: an existing client is updated in
# place (PUT, secret omitted) so its secret and live tokens survive; a missing one is created
# (POST) with a generated secret unless SECRET is given.
set -euo pipefail

: "${HYDRA_ADMIN_URL:=http://localhost:4445}"
: "${CLIENT_ID:?CLIENT_ID is required}"
: "${REDIRECT_URI:?REDIRECT_URI is required}"
: "${USER_TYPE:?USER_TYPE is required (staff, consumer or client)}"
SCOPE="${SCOPE:-openid offline_access}"
AUDIENCE="${AUDIENCE:-bus-$USER_TYPE}"

status=$(curl -s -o /dev/null -w '%{http_code}' "$HYDRA_ADMIN_URL/admin/clients/$CLIENT_ID")

common=$(cat <<JSON
  "client_id": "$CLIENT_ID",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "redirect_uris": ["$REDIRECT_URI"],
  "scope": "$SCOPE",
  "audience": ["$AUDIENCE"],
  "token_endpoint_auth_method": "client_secret_post",
  "metadata": {"user_type": "$USER_TYPE"}
JSON
)

case "$status" in
  404)
    secret="${SECRET:-$(openssl rand -base64 32)}"
    curl -sf -X POST "$HYDRA_ADMIN_URL/admin/clients" -H 'content-type: application/json' \
      -d "{ $common, \"client_secret\": \"$secret\" }" | python3 -m json.tool
    echo "created $CLIENT_ID with secret: $secret"
    ;;
  200)
    curl -sf -X PUT "$HYDRA_ADMIN_URL/admin/clients/$CLIENT_ID" -H 'content-type: application/json' \
      -d "{ $common }" | python3 -m json.tool
    echo "updated $CLIENT_ID (existing client_secret preserved)"
    ;;
  *)
    echo "unexpected status from GET $HYDRA_ADMIN_URL/admin/clients/$CLIENT_ID: $status" >&2
    exit 1
    ;;
esac
