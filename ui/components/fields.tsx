"use client";

import { useState } from "react";
import type { Message } from "@/lib/flow";
import { copy } from "@/lib/messages";

export function Errors({ messages, label }: { messages: Message[]; label?: string }) {
  return (
    <>
      {messages.map((m) => (
        <p className={m.type === "success" ? "ok" : m.type === "info" ? "info" : "err"} key={m.id} role="alert">{copy(m, label)}</p>
      ))}
    </>
  );
}

export function Field({
  name, label, type = "text", placeholder, defaultValue, errors = [], autoComplete,
}: {
  name: string; label: string; type?: string; placeholder: string;
  defaultValue?: string; errors?: Message[]; autoComplete?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label} <span className="req">*</span></label>
      <input
        className="input" id={name} name={name} type={type} required
        placeholder={placeholder} defaultValue={defaultValue}
        autoComplete={autoComplete} aria-invalid={errors.length > 0}
      />
      <Errors messages={errors} label={label} />
    </div>
  );
}

export function PasswordField({
  name, label, value, onChange, errors = [], autoComplete,
}: {
  name?: string; label: string; value?: string;
  onChange?: (v: string) => void; errors?: Message[]; autoComplete: string;
}) {
  const [shown, setShown] = useState(false);
  const id = name ?? label.replace(/\s/g, "-").toLowerCase();
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span className="req">*</span></label>
      <div className="pw">
        <input
          className="input" id={id} name={name} required
          type={shown ? "text" : "password"} placeholder="••••••••"
          value={value} onChange={onChange && ((e) => onChange(e.target.value))}
          autoComplete={autoComplete} aria-invalid={errors.length > 0}
        />
        <button
          type="button" className="eye" onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {shown ? (
              <>
                <path d="M17.94 17.94A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <path d="M1 1l22 22" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      <Errors messages={errors} label={label} />
    </div>
  );
}
