// Login hook, after require_verified_address -> USER_LOGGED_IN
function(ctx) {
  event: "USER_LOGGED_IN",
  data: {
    identity_id: ctx.identity.id,
    phone: ctx.identity.traits.phone,
    email: ctx.identity.traits.email,
  },
}
