"use client";

import { useState, type FormEvent } from "react";
import { useT } from "@/i18n/client";
import { fmt, type Dictionary } from "@/i18n/dictionaries";

type Errors = Record<string, string>;

/** Key for a message about the whole form (e.g. the server refused it), shown by <FormError>. */
export const FORM = "_form";

/**
 * Styled inline validation for uncontrolled forms. Put `noValidate` on the form so the browser's
 * bubbles never show, keep the constraints (required, pattern, minLength…) on the inputs, and pass
 * `errors[name]` to each <Field error>. A `title` on a pattern input is used as its message.
 */
export function useFormErrors() {
  const v = useT().validation;
  const [errors, setErrors] = useState<Errors>({});

  /** Checks every named input; shows messages and focuses the first bad field. True when valid. */
  function validate(form: HTMLFormElement) {
    const next: Errors = {};
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !el.name || el.validity.valid) continue;
      next[el.name] = message(el, v);
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) (form.elements.namedItem(first) as HTMLInputElement | null)?.focus();
    return !first;
  }

  /** Form `onInput`: a field's message (and any form-level message) goes away as soon as it is edited. */
  function clear(e: FormEvent<HTMLFormElement>) {
    const name = (e.target as HTMLInputElement).name;
    if (!errors[FORM] && (!name || !errors[name])) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      delete next[FORM];
      return next;
    });
  }

  /** For checks the inputs can't express (e.g. a choice made with buttons). */
  const setError = (name: string, msg: string) => setErrors((prev) => ({ ...prev, [name]: msg }));

  return { errors, validate, clear, setError, reset: () => setErrors({}) };
}

function message(el: HTMLInputElement | HTMLTextAreaElement, v: Dictionary["validation"]) {
  const s = el.validity;
  if (s.valueMissing) return v.required;
  if (s.typeMismatch && el.type === "email") return v.email;
  if (s.tooShort) return fmt(v.tooShort, { min: el.minLength });
  if (s.patternMismatch && el.title) return el.title;
  return v.invalid;
}

/** Firestore's raw "Missing or insufficient permissions." is not for shoppers. */
export function friendlyError(err: unknown, v: Dictionary["validation"], fallback: string) {
  const code = (err as { code?: string } | null)?.code;
  if (code === "permission-denied" || code === "firestore/permission-denied") return v.saveDenied;
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Firebase Auth failures as a styled message on the right field. `field` is the input to mark
 * (`FORM` for the whole form); `null` means stay quiet (the user closed the Google popup).
 */
export function authError(err: unknown, a: Dictionary["auth"]): { field: string; message: string } | null {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return { field: "password", message: a.errBadCredentials };
    case "auth/invalid-email":
      return { field: "email", message: a.errInvalidEmail };
    case "auth/email-already-in-use":
      return { field: "email", message: a.errEmailInUse };
    case "auth/weak-password":
      return { field: "password", message: a.errWeakPassword };
    case "auth/user-disabled":
      return { field: FORM, message: a.errDisabled };
    case "auth/too-many-requests":
      return { field: FORM, message: a.errTooMany };
    case "auth/network-request-failed":
      return { field: FORM, message: a.errNetwork };
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    default:
      return { field: FORM, message: err instanceof Error && !code ? err.message : a.errGeneric };
  }
}
