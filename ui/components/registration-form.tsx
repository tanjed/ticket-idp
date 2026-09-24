"use client";

import { useState } from "react";
import { Errors, Field, PasswordField } from "./fields";
import { errors, value, type Flow } from "@/lib/flow";

export default function RegistrationForm({ flow }: { flow: Flow }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm !== "" && confirm !== password;
  const gender = value(flow, "traits.gender");

  // Plain HTML POST straight to Kratos (flow.ui.action). On validation errors
  // Kratos redirects back here with the same flow id and per-field messages.
  return (
    <form action={flow.ui.action} method={flow.ui.method}>
      <input type="hidden" name="csrf_token" value={value(flow, "csrf_token")} />
      <input type="hidden" name="method" value="password" />

      <Errors messages={flow.ui.messages ?? []} />

      <div className="row">
        <Field name="traits.name.first" label="First Name" placeholder="Enter first name"
          defaultValue={value(flow, "traits.name.first")} errors={errors(flow, "traits.name.first")}
          autoComplete="given-name" />
        <Field name="traits.name.last" label="Last Name" placeholder="Enter last name"
          defaultValue={value(flow, "traits.name.last")} errors={errors(flow, "traits.name.last")}
          autoComplete="family-name" />
      </div>

      <div className="row">
        <Field name="traits.phone" label="Mobile Number" type="tel" placeholder="Enter your mobile number"
          defaultValue={value(flow, "traits.phone")} errors={errors(flow, "traits.phone")}
          autoComplete="tel" />
        <Field name="traits.email" label="Email" type="email" placeholder="Enter your email"
          defaultValue={value(flow, "traits.email")} errors={errors(flow, "traits.email")}
          autoComplete="email" />
      </div>

      <div className="field">
        <span className="legend">Gender <span className="req">*</span></span>
        <div className="choices">
          {["male", "female"].map((g) => (
            <label className="choice" key={g}>
              <input type="radio" name="traits.gender" value={g} defaultChecked={gender === g} required />
              <span>{g === "male" ? "Male" : "Female"}</span>
            </label>
          ))}
        </div>
        <Errors messages={errors(flow, "traits.gender")} label="Gender" />
      </div>

      <PasswordField name="password" label="Password" value={password} onChange={setPassword}
        errors={errors(flow, "password")} autoComplete="new-password" />
      <PasswordField label="Confirm Password" value={confirm} onChange={setConfirm}
        errors={mismatch ? [{ id: 0, type: "error", text: "Passwords do not match." }] : []}
        autoComplete="new-password" />

      <button className="submit" type="submit" disabled={!password || mismatch || confirm === ""}>
        Sign up
      </button>

      <p className="switch">Already have an account? <a href="/login">Log In</a></p>
    </form>
  );
}
