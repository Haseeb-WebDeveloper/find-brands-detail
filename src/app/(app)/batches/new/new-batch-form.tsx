"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Textarea } from "@/components/ui/textarea";
import { startBatch } from "@/lib/batches/actions";

export function NewBatchForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const result = await startBatch(text);
      if (!result.ok) return setError(result.error);
      router.push(`/batches/${result.batchId}`);
    });

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <p className="text-callout text-label-secondary">
        One brand per line. Add a website after a comma if you know it, for example <code>TIRTIR, tirtir.global</code>.
      </p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} className="font-mono" aria-label="Brands" />
      {error ? <p className="whitespace-pre-line text-footnote text-danger-text">{error}</p> : null}
      <div>
        <Button kind="filled" icon="play" disabled={pending || text.trim() === ""} onClick={submit}>
          {pending ? "Starting…" : "Research"}
        </Button>
      </div>
    </div>
  );
}
