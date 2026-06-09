"use client";

import { useState } from "react";

/**
 * Password field with a show/hide eye toggle. Works both uncontrolled (pass
 * `name` for form submission) and controlled (pass `value`/`onChange`).
 */
export function PasswordInput({
  style,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input
        {...rest}
        type={show ? "text" : "password"}
        style={{ ...style, paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-tertiary)",
        }}
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.3M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            <path d="M2 2l20 20" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
