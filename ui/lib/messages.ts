import type { Message } from "./flow";

// Kratos can't customise its own messages, so we own the copy here, keyed by
// Kratos' stable message id. Unmapped ids fall back to Kratos' English text.
// Ids: https://www.ory.com/docs/kratos/concepts/ui-messages
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
