"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { useToast } from "@/design/toast";
import { fillMissingAi } from "@/lib/brands/actions";

/**
 * "Fill in missing AI parts" for one brand or a batch. Not asked first: it only adds what's empty
 * (campaigns for a brand with none, empty details) and changes nothing already there.
 */
export function FillAiButton({ target, label }: { target: { brandId: string } | { batchId: string }; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      kind="gray"
      icon="assistant"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await fillMissingAi(target);
          if (!result.ok) return toast(result.error);
          toast(result.count === 1 ? "Filling in the missing parts." : `Filling in the missing parts of ${result.count} brands.`);
          router.refresh();
        })
      }
    >
      {pending ? "Starting…" : label}
    </Button>
  );
}
