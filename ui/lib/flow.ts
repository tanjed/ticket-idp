// Kratos flow JSON shapes (API mode).
export type Message = {
  id: number;
  text: string;
  type: string;
  context?: Record<string, any>;
};

export type Node = {
  group: string;
  attributes: { name: string; type: string; value?: string; node_type: string };
  messages: Message[];
};

export type Flow = {
  id: string;
  state?: string;
  ui: { action: string; method: string; nodes: Node[]; messages?: Message[] };
  continue_with?: ContinueWith[];
};

export type ContinueWith =
  | { action: "show_verification_ui"; flow: { id: string; verifiable_address?: string } }
  | { action: "show_settings_ui"; flow: { id: string } }
  | { action: "set_ory_session_token"; ory_session_token: string }
  | { action: string };

// Field name -> messages, plus "_form" for flow-level messages.
export type FieldMessages = Record<string, Message[]>;

export function fieldMessages(flow: Flow | undefined): FieldMessages {
  const out: FieldMessages = {};
  if (!flow?.ui) return out;
  for (const n of flow.ui.nodes ?? []) {
    if (n.messages?.length) out[n.attributes.name] = n.messages;
  }
  if (flow.ui.messages?.length) out._form = flow.ui.messages;
  return out;
}
