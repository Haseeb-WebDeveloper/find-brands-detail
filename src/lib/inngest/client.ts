import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "brand-enrich",
  // Absent locally (the dev server needs none); required in production.
  eventKey: process.env.INNGEST_EVENT_KEY,
});
