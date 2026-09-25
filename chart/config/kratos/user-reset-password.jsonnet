// Settings (password) hook -> USER_RESET_PASSWORD (settings is only reached via recovery).
function(ctx) {
  event: "USER_RESET_PASSWORD",
  data: {
    identity_id: ctx.identity.id,
    email: ctx.identity.traits.email,
    phone: ctx.identity.traits.phone,
    first_name: std.get(std.get(ctx.identity.traits, "name", {}), "first", null),
  },
}
