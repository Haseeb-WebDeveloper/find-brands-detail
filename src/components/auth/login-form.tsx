"use client";

import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { requestMagicLink } from "@/lib/auth/actions";
import { Button } from "@/design/button";
import { Icon } from "@/design/icon";
import { motionPresets } from "@/design/motion";
import { AuthField, emailProblem } from "./field";
import { AUTH_BUTTON } from "./frame";

function Spinner() {
  return <Icon name="loader" className="size-4 animate-spin" />;
}

/**
 * Sign in with an emailed link — the only way in (spec §3). Copied from contractor-sites' login
 * form with the password mode removed.
 *
 * The success state is deliberately identical for an address that has access and one that does
 * not; see the enumeration note on `requestMagicLink` in `lib/auth/actions.ts`. This component must
 * not "helpfully" distinguish them later.
 *
 * AN ERROR SITS UNDER THE FIELD IT IS ABOUT (contractor-sites docs/DESIGN-LANGUAGE.md 9).
 */
export function LoginForm({
  disabled,
  next,
  email: prefilled,
}: {
  disabled?: boolean;
  next?: string | null;
  /** Filled in for somebody sent here with one address in mind. Still editable. */
  email?: string;
}) {
  const [email, setEmail] = useState(prefilled ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  /**
   * The sent state replaces the form rather than sitting beside it: there is nothing left to do on
   * this screen, and a disabled form under a success message reads as "it didn't work".
   */
  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionPresets.move}
        className="flex flex-col items-center gap-4 text-center"
      >
        <span className="grid size-16 place-items-center rounded-full bg-fill text-(--auth-muted)">
          <Icon name="mail" className="size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <p className="text-title-3">Check your email</p>
          <p className="text-body text-(--auth-muted)">
            If <span className="font-medium text-label">{email}</span> is on the team, a link is on its
            way. It works for an hour.
          </p>
        </div>
        <p className="text-callout text-(--auth-muted)">Not invited yet? Then no email will come.</p>
        <Button
          kind="plain"
          size="lg"
          className={AUTH_BUTTON.outline}
          onClick={() => {
            setSent(false);
            setError(undefined);
          }}
        >
          Use a different address
        </Button>
      </motion.div>
    );
  }

  const off = disabled || pending;

  return (
    <form
      // Our checks, not the browser's bubble: see `AuthField`.
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const problem = emailProblem(email);
        setError(problem);
        if (problem) {
          e.currentTarget.querySelector<HTMLInputElement>("[name=email]")?.focus();
          return;
        }
        startTransition(async () => {
          const result = await requestMagicLink(email, next ?? undefined);
          if (result.ok) setSent(true);
          else setError(result.error);
        });
      }}
      className="flex flex-col gap-4"
    >
      <AuthField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        disabled={off}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          // The message goes the moment somebody starts fixing it.
          setError(undefined);
        }}
        placeholder="you@yourcompany.com"
        error={error}
      />

      <div className="mt-2 flex flex-col gap-3">
        <Button type="submit" kind="filled" size="lg" disabled={off} className={AUTH_BUTTON.main}>
          {pending ? <Spinner /> : null}
          Continue with email
        </Button>
      </div>
    </form>
  );
}
