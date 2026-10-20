import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/design/cn";
import { Icon } from "@/design/icon";
import { DesignRoot } from "@/design/root";
import { DashboardTheme } from "@/components/app/theme";

/**
 * The frame every signed-out screen of ours shares, in the new design language
 * (docs/DESIGN-LANGUAGE.md): sign in, start a free trial, the business step, an invitation.
 *
 * ONE CENTRED COLUMN, NOTHING AROUND IT (owner, 2026-10-14). The form is content, so it is solid and
 * sits straight on the page: no card, because nothing is being separated from anything, and no glass,
 * because nothing here floats. The logo and the title centre; labels, fields and errors stay left,
 * where they are quicker to read.
 *
 * Light or dark follows the computer. `DashboardTheme` is the switch the office uses, and it takes its
 * class off `<html>` again on the way out, so a contractor's site visited next is untouched.
 *
 * `--auth-muted` is the quiet colour of these screens: labels, the line under the title, the footer.
 * Stronger than the office's `label-secondary` (owner, 2026-10-14: "if somebody wants to read it, it
 * should be easy"), because a signed-out screen has a few lines and every one is meant to be read.
 * Placeholders keep the softer grey, so an example never looks like something already typed.
 *
 * 448px wide (`max-w-md`) for sign in and sign-up, one email field; `wide` (576px) for the business
 * steps, which hold a logo, an address and the profiles. The sizes inside are the same either way
 * (owner, 2026-10-14: a bigger scale for the wide form was "too big").
 *
 * `homeHref` is passed in because these screens run on the broker (`auth.<root>`), where `/` is not
 * our homepage.
 */
export function AuthFrame({
  title,
  subtitle,
  homeHref = "/",
  wide = false,
  notice,
  children,
  footnote,
}: {
  /** Absent when the page draws its own, changing title: the sign-up steps (`AuthTitle`). */
  title?: string;
  /**
   * ONE short line, only where leaving it out would cost something real: sign-up's "30 days free. No
   * card needed." answers the first worry before anybody types. Sign in has none.
   */
  subtitle?: string;
  homeHref?: string;
  wide?: boolean;
  /** A message about how somebody arrived: an expired link, a revoked invitation. Above the form. */
  notice?: ReactNode;
  children: ReactNode;
  /** The way to the other screen ("New here? Start a free trial"). Under everything. */
  footnote?: ReactNode;
}) {
  return (
    <DashboardTheme>
      <DesignRoot
        frame
        className="flex flex-col items-center bg-page px-4 py-16 text-label [--auth-muted:color-mix(in_oklab,var(--ds-label)_78%,var(--ds-page))]"
      >
        <div className={cn("my-auto flex w-full flex-col", wide ? "max-w-xl" : "max-w-md")}>
          <header className="flex flex-col items-center gap-6 text-center">
            <Link
              href={homeHref}
              aria-label="Brand Enrich"
              className="grid size-10 place-items-center rounded-card bg-label text-page"
            >
              <Icon name="inbox" className="size-5" />
            </Link>
            {title ? <AuthTitle title={title} subtitle={subtitle} /> : null}
          </header>

          {notice ? <div className="mt-8">{notice}</div> : null}

          <div className="mt-8 flex flex-col gap-4">{children}</div>

          {footnote ? (
            <div className="mt-8 text-center text-body text-(--auth-muted)">{footnote}</div>
          ) : null}
        </div>
      </DesignRoot>
    </DashboardTheme>
  );
}

/**
 * A message above the form. A status in this language is a TINT: a soft fill with the strong colour
 * as the words, never a solid block.
 *
 * `role="alert"` only for a failure: a neutral notice announced as an alert interrupts a screen reader
 * for something that is not urgent.
 */
export function AuthMessage({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={
        tone === "error"
          ? "rounded-inner bg-system-red/10 px-4 py-3 text-callout text-danger-text"
          : "rounded-inner bg-fill px-4 py-3 text-callout text-label"
      }
    >
      {children}
    </p>
  );
}

/** The "or" between Google and the email field. */
export function AuthOr() {
  return (
    <div className="flex items-center gap-3 text-subhead text-(--auth-muted)">
      <span className="h-px flex-1 bg-separator" />
      or
      <span className="h-px flex-1 bg-separator" />
    </div>
  );
}

/** A link inside a footnote: full-strength words, underlined under the pointer. Not blue: the one blue
 *  thing on the screen is the main button (owner, 2026-10-14). */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-label underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/**
 * HOVER, AND THE OUTLINE BUTTON, for the signed-out screens (owner, 2026-10-14). The shared `Button`
 * answers only on press; on these screens a mouse should see what it is over too. Added from outside
 * as classes, so the office's buttons are unchanged.
 *
 *   main      the one filled action, a touch brighter under the pointer
 *   google    the grey "Continue with Google"
 *   outline   the other way to do the same thing ("Use a password instead"): a hairline capsule,
 *             so it reads as a button without competing with the filled one
 *
 * `hover:` only applies where a pointer can hover, so a phone never shows a stuck highlight.
 */
export const AUTH_BUTTON = {
  main: "w-full transition-[filter,opacity] hover:brightness-110",
  google: "w-full transition-[background-color,opacity] hover:bg-fill-strong",
  outline:
    "w-full border border-fill-strong text-label transition-[background-color,opacity] hover:bg-fill",
} as const;

/** The page's title and its one line, centred. The frame draws it; the sign-up steps draw their own. */
export function AuthTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-large-title text-balance">{title}</h1>
      {subtitle ? <p className="text-body text-balance text-(--auth-muted)">{subtitle}</p> : null}
    </div>
  );
}

/**
 * A group of fields under its own title ("Where you are based"). The title is two sizes up from the
 * labels, and each group after the first opens with a hairline and space above it (owner,
 * 2026-10-14: small titles with little space did not read as separate groups).
 */
export function AuthSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-separator not-first:border-t not-first:pt-10">
      {title ? <h2 className="text-title-2 text-label">{title}</h2> : null}
      {children}
    </section>
  );
}
