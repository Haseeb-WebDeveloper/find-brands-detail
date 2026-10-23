"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { TextField } from "@/design/text-field";
import { useToast } from "@/design/toast";
import { chooseValue, typeValue } from "@/lib/review/actions";
import type { ReviewField } from "@/lib/export/row";

const WORD = { proven: "proven", review: "needs a look", rejected: "rejected" } as const;

/** Makes another of research's candidates the chosen value. */
export function UseThisButton({ brandId, field, candidateId }: { brandId: string; field: ReviewField; candidateId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      kind="plain"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await chooseValue(brandId, field, candidateId);
          if (!r.ok) return toast(r.error, { tone: "error" });
          router.refresh();
        })
      }
    >
      {pending ? "Choosing…" : "Use this"}
    </Button>
  );
}

const PLACEHOLDER: Record<ReviewField, string> = {
  website: "Website address",
  instagram: "Instagram handle or link",
  tiktok: "TikTok handle or link",
  logo: "Image address (right-click the image → Copy image address)",
  cover: "Image address (right-click the image → Copy image address)",
};

/** The reviewer's own value, checked at once and then chosen (spec §8). */
export function TypeValue({ brandId, field }: { brandId: string; field: ReviewField }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await typeValue(brandId, field, value);
      if (!r.ok) return toast(r.error, { tone: "error" });
      toast(`Checked: ${WORD[r.score]}. ${r.reason.replace(/^Typed by a reviewer\. /, "")}`, { tone: r.score === "proven" ? "success" : r.score === "rejected" ? "error" : "info" });
      setValue("");
      router.refresh();
    });
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) submit();
      }}
    >
      <TextField label={`Your own ${field === "logo" || field === "cover" ? `${field} image` : field}`} hideLabel placeholder={PLACEHOLDER[field]} value={value} onChange={(e) => setValue(e.currentTarget.value)} className="flex-1" />
      <Button kind="gray" type="submit" disabled={pending || !value.trim()}>
        {pending ? "Checking…" : "Check and use"}
      </Button>
    </form>
  );
}
