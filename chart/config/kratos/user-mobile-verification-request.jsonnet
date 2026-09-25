// Courier (sms channel) -> USER_MOBILE_VERIFICATION_REQUEST. Other messages on this channel get
// event null: the webhook acks and drops them.
function(ctx)
  local d = std.get(ctx, "template_data", {});
  local identity = std.get(d, "identity", {});
  {
    event: if ctx.template_type == "verification_code_valid" then "USER_MOBILE_VERIFICATION_REQUEST" else null,
    data: {
      identity_id: std.get(identity, "id", null),
      recipient: ctx.recipient,
      channel: "sms",
      code: std.get(d, "verification_code", null),
      expires_in_minutes: std.get(d, "expires_in_minutes", null),
      first_name: std.get(std.get(std.get(identity, "traits", {}), "name", {}), "first", null),
    },
  }
