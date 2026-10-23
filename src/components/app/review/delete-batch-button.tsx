"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Dialog } from "@/design/dialog";
import { useToast } from "@/design/toast";
import { deleteBatch } from "@/lib/batches/actions";

/** "Delete" on a batch page: asks first (it can't be undone), then goes back to the batch list. */
export function DeleteBatchButton({ batchId, batchName, brandCount }: { batchId: string; batchName: string; brandCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const result = await deleteBatch(batchId);
      if (!result.ok) {
        setOpen(false);
        return toast(result.error, { tone: "error" });
      }
      toast(`Deleted ${batchName}.`);
      router.push("/");
    });

  return (
    <>
      <Button kind="gray" icon="delete" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={`Delete ${batchName}?`}
        detail={`Its ${brandCount === 1 ? "brand" : `${brandCount} brands`}, their campaigns and review choices go with it. This can't be undone.`}
        confirm={pending ? "Deleting…" : "Delete"}
        cancel="Keep it"
        destructive
        busy={pending}
        closeOnConfirm={false}
        onConfirm={confirm}
      />
    </>
  );
}
