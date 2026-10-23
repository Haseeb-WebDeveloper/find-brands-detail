"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { useToast } from "@/design/toast";
import { findMoreCampaigns } from "@/lib/brands/actions";

/** "Find more campaigns": adds campaigns the brand doesn't have yet after its own; replaces nothing. */
export function FindMoreCampaignsButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      kind="plain"
      size="sm"
      icon="search"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await findMoreCampaigns(brandId);
          if (!result.ok) return toast(result.error, { tone: "error" });
          toast("Looking for more campaigns.", { tone: "info" });
          router.refresh();
        })
      }
    >
      {pending ? "Starting…" : "Find more campaigns"}
    </Button>
  );
}
