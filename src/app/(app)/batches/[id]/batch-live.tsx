"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { BRAND_EVENTS, batchTopic } from "@/lib/realtime/channels";

/**
 * Listens on the batch's private channel and re-renders from the server on every change, after
 * contractor-sites' `support-live.tsx`. The message carries ids only; nothing shown comes from
 * Realtime. Refreshes are coalesced so 25 brands finishing steps at once cause a handful of renders,
 * not hundreds.
 */
export function BatchLive({ batchId }: { batchId: string }) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refreshSoon = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        routerRef.current.refresh();
      }, 400);
    };

    void (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase.channel(batchTopic(batchId), { config: { private: true } });
      channel.on("broadcast", { event: BRAND_EVENTS.CHANGED }, refreshSoon);
      channel.subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[realtime] batch channel", status, error?.message ?? "");
        }
      });
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [batchId]);

  return null;
}
