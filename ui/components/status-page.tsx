type Tone = "lock" | "check" | "clock" | "alert";

const ICONS: Record<Tone, React.ReactNode> = {
  lock: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  check: (<><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  alert: (<><path d="M12 3 2.5 20h19L12 3z" /><path d="M12 10v4M12 17.5v.01" /></>),
};

// The standard full-page message: an icon, a title, a line of text and an optional button.
export default function StatusPage({
  tone,
  title,
  children,
  action,
}: {
  tone: Tone;
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <main className="page">
      <div className="status">
        <div className={`status-icon ${tone}`} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[tone]}
          </svg>
        </div>
        <h1>{title}</h1>
        {children && <p className="lead">{children}</p>}
        {action && <a className="submit" href={action.href}>{action.label}</a>}
      </div>
    </main>
  );
}
