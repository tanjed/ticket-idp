// Registration hook -> USER_REGISTERED
function(ctx) {
  event: "USER_REGISTERED",
  data: {
    identity_id: ctx.identity.id,
    email: ctx.identity.traits.email,
    phone: ctx.identity.traits.phone,
    first_name: std.get(std.get(ctx.identity.traits, "name", {}), "first", null),
    last_name: std.get(std.get(ctx.identity.traits, "name", {}), "last", null),
    gender: std.get(ctx.identity.traits, "gender", null),
  },
}
