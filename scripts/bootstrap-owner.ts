/**
 * Creates the first owner's invitation:  pnpm bootstrap you@company.com
 * Then sign in at /login with that email; the invitation is claimed on first sign-in.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: pnpm bootstrap you@company.com");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

if ((await prisma.user.count({ where: { role: "owner" } })) > 0) {
  console.error("An owner already exists. Invite people from the Team page instead.");
  process.exit(1);
}

await prisma.invitation.create({
  data: { email, role: "owner", expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
});
console.log(`Owner invitation created for ${email}. Sign in at /login with that address.`);
await prisma.$disconnect();
await pool.end();
