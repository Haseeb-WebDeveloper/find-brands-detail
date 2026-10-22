"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Dialog } from "@/design/dialog";
import { TextField } from "@/design/text-field";
import { Textarea } from "@/components/ui/textarea";
import { startBatch } from "@/lib/batches/actions";
import { MAX_BATCH_NAME, defaultBatchName } from "@/lib/batches/name";

/**
 * "New batch": a name (or the date, by default) and the brands, one per line; research starts and
 * the batch's page opens, live.
 */
export function NewBatchButton({ aiOn = true }: { aiOn?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // The default name, fixed when the dialog opens, in the reviewer's own time.
  const [fallback, setFallback] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const result = await startBatch(text, name.trim() || fallback);
      if (!result.ok) return setError(result.error);
      setOpen(false);
      setName("");
      setText("");
      setError(null);
      router.push(`/batches/${result.batchId}`);
    });

  return (
    <>
      <Button
        kind="filled"
        icon="add"
        onClick={() => {
          setFallback(defaultBatchName(new Date()));
          setOpen(true);
        }}
      >
        New batch
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title="New batch"
        confirm={pending ? "Starting…" : "Start research"}
        busy={pending || text.trim() === ""}
        closeOnConfirm={false}
        onConfirm={submit}
        wide
      >
        <div className="flex flex-col gap-4">
          <TextField label="Name" value={name} maxLength={MAX_BATCH_NAME} placeholder={fallback} onChange={(e) => setName(e.currentTarget.value)} />
          <div className="flex flex-col gap-1.5">
            <span className="text-subhead text-label-secondary">Brands</span>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={"TIRTIR, tirtir.global\nnumbuzin\nDr.G, dr-g.com"}
              className="font-mono"
              aria-label="Brands"
            />
            <p className="text-footnote text-label-secondary">
              One brand per line.{" "}
              {aiOn
                ? "If you know its website, add it after a comma"
                : "Add its website after a comma (no AI key is set up, so websites and campaigns can't be searched for)"}
              , or paste two columns from a spreadsheet. Up to 50 brands.
            </p>
          </div>
          {error ? <p className="whitespace-pre-line text-footnote text-danger-text">{error}</p> : null}
        </div>
      </Dialog>
    </>
  );
}
