// Request body Kratos POSTs to the notification service for every email / SMS.
// `template_data` carries the code (verification_code / recovery_code).
function(ctx) {
  recipient: ctx.recipient,
  message_type: std.get(ctx, "message_type", null),
  template_type: ctx.template_type,
  template_data: std.get(ctx, "template_data", {}),
  subject: std.get(ctx, "subject", null),
  body: std.get(ctx, "body", null),
}
