import "server-only";

/**
 * Pushing a message onto a Realtime channel from the server.
 *
 * ## Why the server and not the browser that caused it
 *
 * Supabase lets a subscribed client broadcast on a channel it holds, and that would have been two
 * lines instead of this file. It is the wrong place. A browser's broadcast can be rate-limited,
 * dropped on a flaky connection, or simply never sent because the tab was closed the instant after
 * the action returned — and the one moment we most need the other person to hear about a change is
 * the moment somebody did something and walked away. This runs after the row is committed, from the
 * machine that committed it.
 *
 * ## Failure is silent, and that is the design
 *
 * The database write has already happened by the time this is called. If the push fails, the change
 * is still true; the other cockpit simply learns about it on its next navigation instead of within
 * the second. So a broadcast failure must never fail the action that triggered it — a person who
 * successfully sent a reply must not be told it did not work because a websocket fan-out hiccuped.
 *
 * That is the rule for everything in `lib/realtime`: **a broadcast is a speed layer over the
 * database, never a source of truth.** Nothing may exist only in a broadcast.
 *
 * ## The service role key
 *
 * Publishing bypasses the `realtime.messages` policies, which is why it needs the service key and
 * why it can only happen here. The policies in `0029_realtime_presence.sql` govern who may RECEIVE.
 */

export type BroadcastMessage = {
  /** The channel. `admin:inbox`, or `thread:<companyId>`. */
  topic: string;
  event: string;
  payload: unknown;
};

/**
 * Send one or more broadcasts. Never throws, never rejects.
 *
 * Callers use `void broadcast(...)` without awaiting: the response is of no interest to the request
 * that triggered it, and making somebody wait for a fan-out before their action returns would put
 * network latency in front of a write that has already succeeded.
 */
export async function broadcast(
  messages: BroadcastMessage | BroadcastMessage[],
): Promise<{ ok: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // Not an error. Realtime is optional: a deployment without the service key works exactly as the
  // cockpit did before this existed, with every screen updating on navigation.
  if (!url || !key) return { ok: false };

  const list = Array.isArray(messages) ? messages : [messages];
  if (list.length === 0) return { ok: true };

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: list.map((m) => ({ ...m, private: true })),
      }),
      // Nothing downstream should ever wait on this. Five seconds is already longer than a person
      // would tolerate if it somehow did end up on the critical path.
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[realtime] broadcast refused", {
        status: response.status,
        body: body.slice(0, 300),
      });
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    // A persistent failure here means the URL or the key is wrong, which no user can report because
    // nothing they see is broken. The log is the only signal there is.
    console.error("[realtime] broadcast threw", error);
    return { ok: false };
  }
}
