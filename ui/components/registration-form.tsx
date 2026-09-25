"use client";

import { useState } from "react";
import { Errors, Field, PasswordField } from "./fields";
import type { Flash } from "@/lib/ctx";

export default function RegistrationForm({ flash }: { flash?: Flash }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm !== "" && confirm !== password;
  const v = (name: string) => flash?.values[name];
  const e = (name: string) => flash?.fields[name];

  return (
    <form action="/registration/submit" method="POST">
      <Errors messages={flash?.fields._form ?? []} />

      <div className="row">
        <Field name="traits.name.first" label="First Name" placeholder="Enter first name"
          defaultValue={v("traits.name.first")} errors={e("traits.name.first")} autoComplete="given-name" />
        <Field name="traits.name.last" label="Last Name" placeholder="Enter last name"
          defaultValue={v("traits.name.last")} errors={e("traits.name.last")} autoComplete="family-name" />
      </div>

      <div className="row">
        <Field name="traits.phone" label="Mobile Number" type="tel" placeholder="Enter your mobile number"
          defaultValue={v("traits.phone")} errors={e("traits.phone")} autoComplete="tel" />
        <Field name="traits.email" label="Email" type="email" placeholder="Enter your email"
          defaultValue={v("traits.email")} errors={e("traits.email")} autoComplete="email" />
      </div>

      <div className="field">
        <span className="legend">Gender <span className="req">*</span></span>
        <div className="choices">
          {["male", "female"].map((g) => (
            <label className="choice" key={g}>
              <input type="radio" name="traits.gender" value={g} defaultChecked={v("traits.gender") === g} required />
              <span>{g === "male" ? "Male" : "Female"}</span>
            </label>
          ))}
        </div>
        <Errors messages={e("traits.gender") ?? []} label="Gender" />
      </div>

      <PasswordField name="password" label="Password" value={password} onChange={setPassword}
        errors={e("password")} autoComplete="new-password" />
      <PasswordField label="Confirm Password" value={confirm} onChange={setConfirm}
        errors={mismatch ? [{ id: 0, type: "error", text: "Passwords do not match." }] : []}
        autoComplete="new-password" />

      <button className="submit" type="submit" disabled={!password || mismatch || confirm === ""}>Sign up</button>

      <p className="switch">Already have an account? <a href="/login">Log In</a></p>
    </form>
  );
}
