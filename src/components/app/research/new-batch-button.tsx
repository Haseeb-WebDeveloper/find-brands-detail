"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Dialog } from "@/design/dialog";
import { Textarea } from "@/components/ui/textarea";
import { startBatch } from "@/lib/batches/actions";

/** "New batch": paste brands in a dialog; research starts and the batch's page opens, live. */
export function NewBatchButton({ aiOn = true }: { aiOn?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const result = await startBatch(text);
      if (!result.ok) return setError(result.error);
      setOpen(false);
      setText("");
      setError(null);
      router.push(`/batches/${result.batchId}`);
    });

  return (
    <>
      <Button kind="filled" icon="add" onClick={() => setOpen(true)}>
        New batch
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title="New batch"
        detail={
          aiOn
            ? "One brand per line. Add its website after a comma if you know it."
            : "One brand per line, with its website after a comma. No AI key is set up, so websites and campaigns can't be searched for."
        }
        confirm={pending ? "Starting…" : "Start research"}
        busy={pending || text.trim() === ""}
        closeOnConfirm={false}
        onConfirm={submit}
        wide
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          autoFocus
          placeholder={"TIRTIR, tirtir.global\nnumbuzin\nDr.G"}
          className="font-mono"
          aria-label="Brands"
        />
        {error ? <p className="whitespace-pre-line text-footnote text-danger-text">{error}</p> : null}
      </Dialog>
    </>
  );
}
