/**
 * Proves the browser key can read and write nothing. Run against the real project:
 *   pnpm verify:lockdown
 * Exits non-zero on any leak.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const TABLES = [
  "users", "invitations", "batches", "brands", "candidates",
  "selections", "campaigns", "campaign_images", "brand_text", "brand_pages", "research_logs", "ai_calls",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.");

const headers = { apikey: key, "Content-Type": "application/json" };
let leaks = 0;

for (const table of TABLES) {
  const read = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  const readBody = await read.text();
  const readLeaked = read.ok && readBody.trim() !== "[]";
  const write = await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers, body: "{}" });
  const writeLeaked = write.ok;
  console.log(`${table.padEnd(16)} read ${read.status}${readLeaked ? " LEAK" : ""} · write ${write.status}${writeLeaked ? " LEAK" : ""}`);
  if (readLeaked || writeLeaked) leaks++;
}

if (leaks > 0) {
  console.error(`${leaks} table(s) reachable with the publishable key.`);
  process.exit(1);
}
console.log("Locked down: the publishable key reads and writes nothing.");
