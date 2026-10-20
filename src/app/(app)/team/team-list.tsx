"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { ListGroup, ListRow, Pill } from "@/design/list";
import { Sheet } from "@/design/sheet";
import { Segmented } from "@/design/segmented";
import { TextField } from "@/design/text-field";
import { useToast } from "@/design/toast";
import { sayAgo } from "@/design/ago";
import { ROLE_DESCRIPTION, ROLE_LABEL, type MemberRole } from "@/lib/auth/roles";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation } from "@/lib/team/actions";
import type { PendingInvite, TeamMember } from "@/lib/team/scoped";

type Result = { ok: true } | { ok: false; error: string };

/** Runs a server action, toasts the outcome in the past tense, and re-reads the page. */
function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, done: string) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) return toast(result.error);
      toast(done);
      router.refresh();
    });
  return { pending, run };
}

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const { pending, run } = useAction();

  const submit = () => {
    const invited = email.trim();
    run(async () => {
      const result = await inviteMember(invited, role);
      if (result.ok) {
        setOpen(false);
        setEmail("");
      }
      return result;
    }, `Invited ${invited}. They can sign in at /login.`);
  };

  return (
    <Sheet
      title="Invite to the team"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button kind="filled" icon="add">
          Invite
        </Button>
      }
      action={{ label: pending ? "Inviting…" : "Invite", onSelect: submit }}
    >
      <div className="flex flex-col gap-4">
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <Segmented<MemberRole>
          label="Role"
          value={role}
          onValueChange={setRole}
          options={[
            { value: "member", label: ROLE_LABEL.member },
            { value: "owner", label: ROLE_LABEL.owner },
          ]}
        />
        <p className="text-footnote text-label-secondary">{ROLE_DESCRIPTION[role]}</p>
      </div>
    </Sheet>
  );
}

export function TeamList({
  members,
  invites,
  selfId,
  canWrite,
}: {
  members: TeamMember[];
  invites: PendingInvite[];
  selfId: string;
  canWrite: boolean;
}) {
  const { pending, run } = useAction();

  return (
    <div className="flex flex-col gap-6">
      <ListGroup>
        {members.map((m, i) => (
          <ListRow
            key={m.id}
            first={i === 0}
            title={m.id === selfId ? `${m.email} (you)` : m.email}
            detail={`Joined ${sayAgo(m.createdAt)}`}
            trailing={
              <div className="flex items-center gap-2">
                <Pill tone={m.role === "owner" ? "blue" : "grey"}>{ROLE_LABEL[m.role]}</Pill>
                {canWrite && m.id !== selfId ? (
                  <>
                    <Button
                      kind="plain"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => changeMemberRole(m.id, m.role === "owner" ? "member" : "owner"),
                          `${m.email} is now ${m.role === "owner" ? "a member" : "an owner"}.`,
                        )
                      }
                    >
                      {m.role === "owner" ? "Make member" : "Make owner"}
                    </Button>
                    <Button
                      kind="plain"
                      size="sm"
                      destructive
                      disabled={pending}
                      onClick={() => run(() => removeMember(m.id), `Removed ${m.email}.`)}
                    >
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            }
          />
        ))}
      </ListGroup>

      {invites.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-label">Invited</h2>
          <ListGroup>
            {invites.map((inv, i) => (
              <ListRow
                key={inv.id}
                first={i === 0}
                title={inv.email}
                detail={`${ROLE_LABEL[inv.role]} · waiting for first sign-in`}
                trailing={
                  canWrite ? (
                    <Button
                      kind="plain"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => revokeInvitation(inv.id), `Revoked the invitation for ${inv.email}.`)}
                    >
                      Revoke
                    </Button>
                  ) : null
                }
              />
            ))}
          </ListGroup>
        </section>
      ) : null}
    </div>
  );
}
