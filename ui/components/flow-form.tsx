import { Errors, Field, PasswordField } from "./fields";
import type { Flow, Node } from "@/lib/flow";

// Renders a Kratos flow's nodes generically: used by recovery, verification
// and settings, whose fields are chosen by Kratos (per flow state), not by us.
const LABELS: Record<string, string> = {
  email: "Email",
  code: "Verification code",
  password: "New password",
};

export default function FlowForm({ flow, groups }: { flow: Flow; groups?: string[] }) {
  const nodes = flow.ui.nodes.filter(
    (n) => n.attributes.node_type === "input" && (!groups || groups.includes(n.group)),
  );
  const primary = nodes.find((n) => n.attributes.type === "submit");

  return (
    <form action={flow.ui.action} method={flow.ui.method}>
      <Errors messages={flow.ui.messages ?? []} />
      {nodes.map((n) => renderNode(n, n === primary))}
    </form>
  );
}

function renderNode(n: Node, isPrimary: boolean) {
  const { name, type, value } = n.attributes;
  const label = LABELS[name] ?? n.meta?.label?.text ?? name;
  const key = `${name}:${type}`;

  if (type === "hidden") return <input key={key} type="hidden" name={name} value={value ?? ""} />;

  if (type === "submit") {
    return (
      <button
        key={key} type="submit" name={name} value={value ?? ""}
        className={isPrimary ? "submit" : "submit secondary"} formNoValidate={!isPrimary}
      >
        {n.meta?.label?.text ?? "Submit"}
      </button>
    );
  }

  if (type === "password") {
    return <PasswordField key={key} name={name} label={label} errors={n.messages} autoComplete="new-password" />;
  }

  return (
    <Field key={key} name={name} label={label} type={type} defaultValue={value}
      placeholder={`Enter ${label.toLowerCase()}`} errors={n.messages}
      autoComplete={name === "code" ? "one-time-code" : name === "email" ? "email" : undefined} />
  );
}
