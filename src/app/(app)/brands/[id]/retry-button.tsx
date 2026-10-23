"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Dialog } from "@/design/dialog";
import { useToast } from "@/design/toast";
import { retryResearch } from "@/lib/brands/actions";

/** Research again replaces every result, the reviewer's typed values and campaign edits included: asked first. */
export function RetryButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button kind="gray" icon="retry" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "Starting…" : "Run research again"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Run research again?"
        detail="It replaces everything found for this brand, including values you typed and campaigns you edited or added. Brand details stay."
        confirm="Run again"
        destructive
        onConfirm={() =>
          start(async () => {
            const result = await retryResearch(brandId);
            if (!result.ok) return toast(result.error, { tone: "error" });
            toast("Research started again.", { tone: "info" });
            router.refresh();
          })
        }
      />
    </>
  );
}
