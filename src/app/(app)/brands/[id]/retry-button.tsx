"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { useToast } from "@/design/toast";
import { retryResearch } from "@/lib/brands/actions";

export function RetryButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      kind="gray"
      icon="retry"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await retryResearch(brandId);
          if (!result.ok) return toast(result.error);
          toast("Research started again.");
          router.refresh();
        })
      }
    >
      {pending ? "Starting…" : "Run research again"}
    </Button>
  );
}
