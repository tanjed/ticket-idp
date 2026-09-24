// Pure flow types/helpers, safe to import from client components.
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
  meta?: { label?: { text: string } };
};

export type Flow = {
  id: string;
  state?: string;
  ui: { action: string; method: string; nodes: Node[]; messages?: Message[] };
};

export const node = (flow: Flow, name: string) =>
  flow.ui.nodes.find((n) => n.attributes.name === name);

export const value = (flow: Flow, name: string) => node(flow, name)?.attributes.value ?? "";

export const errors = (flow: Flow, name: string) => node(flow, name)?.messages ?? [];
