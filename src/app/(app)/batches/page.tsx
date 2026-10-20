import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/scope";

/** The batches live on the home page now. */
export default async function BatchesPage() {
  await requireMember();
  redirect("/");
}
