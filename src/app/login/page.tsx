import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authConfigured } from "@/lib/auth/config";
import { getTeamScope } from "@/lib/auth/scope";
import { LoginForm } from "@/components/auth/login-form";
import { AuthFrame, AuthMessage } from "@/components/auth/frame";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; email?: string }>;
}) {
  if (await getTeamScope()) redirect("/batches");
  const { error, next, email } = await searchParams;
  const configured = authConfigured();

  return (
    <AuthFrame
      title="Sign in"
      homeHref="/login"
      notice={
        error === "link" ? (
          <AuthMessage>That link has expired or was already used. Ask for a new one below.</AuthMessage>
        ) : error === "access" ? (
          <AuthMessage>This email isn&apos;t on the team. Ask an owner to invite you.</AuthMessage>
        ) : !configured ? (
          <AuthMessage tone="info">Sign-in isn&apos;t set up here. Set the Supabase URL and publishable key.</AuthMessage>
        ) : null
      }
      footnote={<>Brand Enrich is invite-only.</>}
    >
      <LoginForm disabled={!configured} next={next ?? null} email={email} />
    </AuthFrame>
  );
}
