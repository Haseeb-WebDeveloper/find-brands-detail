/**
 * Proves a signed-out browser cannot join a private channel:  pnpm verify:realtime
 * Uses only the publishable key, exactly as a stranger's browser would. Exits non-zero if it joins.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.");

const supabase = createClient(url, key);
const channel = supabase.channel("batch:00000000-0000-0000-0000-000000000000", { config: { private: true } });

const status = await new Promise<string>((resolve) => {
  const timer = setTimeout(() => resolve("TIMED_OUT"), 15_000);
  channel.subscribe((s, err) => {
    if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
      clearTimeout(timer);
      resolve(err ? `${s}: ${err.message}` : s);
    }
  });
});

await supabase.removeChannel(channel);
console.log(`Signed-out join of a private batch channel → ${status}`);
if (status === "SUBSCRIBED") {
  console.error("LEAK: a signed-out client joined a private channel.");
  process.exit(1);
}
// Only an explicit authorization refusal proves the policy. Any other error (a timeout, a
// partition problem) means the check could not run, which is not the same as passing.
if (/unauthori[sz]ed|permission/i.test(status)) {
  console.log("Refused by policy: private channels are closed to signed-out browsers.");
  process.exit(0);
}
console.error("INCONCLUSIVE: the join failed for a reason other than authorization.");
process.exit(2);
