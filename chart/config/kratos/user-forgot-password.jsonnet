// Courier (email) -> USER_FORGOT_PASSWORD. Other messages (e.g. the notice sent to an address with
// no account) get event null: the webhook acks and drops them.
function(ctx)
  local d = std.get(ctx, "template_data", {});
  local identity = std.get(d, "identity", {});
  {
    event: if ctx.template_type == "recovery_code_valid" then "USER_FORGOT_PASSWORD" else null,
    data: {
      identity_id: std.get(identity, "id", null),
      recipient: ctx.recipient,
      channel: "email",
      code: std.get(d, "recovery_code", null),
      expires_in_minutes: std.get(d, "expires_in_minutes", null),
      first_name: std.get(std.get(std.get(identity, "traits", {}), "name", {}), "first", null),
    },
  }
