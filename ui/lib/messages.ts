import type { Message } from "./flow";

// Kratos can't customise its messages: our copy, keyed by message id (unmapped ids fall
// back to Kratos' text). Ids: https://www.ory.com/docs/kratos/concepts/ui-messages
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export function copy(m: Message, label?: string): string {
  switch (m.id) {
    case 4000001: // generic validation failure (e.g. value not in enum)
      return label ? `Select a valid ${label.toLowerCase()}.` : m.text;
    case 4000002: // required property missing
      return label ? `${sentence(label)} is required.` : m.text;
    case 4000006: // login: wrong identifier or password
      return "Invalid Mobile/Password";
    case 4000007: // registration: identifier already taken
      return "An account with this mobile number or email already exists.";
    case 1080003: // verification code sent (Kratos text says "email"; ours is SMS)
      return "We sent an OTP to your mobile number.";
    case 4070006: // verification code wrong / used
      return "Invalid or expired OTP. Please try again.";
    case 4000032: // password too short
      return `Password must be at least ${m.context?.min_length ?? 8} characters.`;
    case 4000040:
      return "Enter a valid email address.";
    case 4000041:
      return "Enter a valid mobile number, e.g. +8801712345678.";
    default:
      return m.text;
  }
}
