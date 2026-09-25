// Verification hook -> USER_MOBILE_VERIFICATION_SUCCESS
function(ctx) {
  event: "USER_MOBILE_VERIFICATION_SUCCESS",
  data: {
    identity_id: ctx.identity.id,
    phone: ctx.identity.traits.phone,
    first_name: std.get(std.get(ctx.identity.traits, "name", {}), "first", null),
  },
}
