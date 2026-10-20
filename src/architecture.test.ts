import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles("src");

describe("architecture", () => {
  it("never imports the private contractor-sites template package", () => {
    // Matches real imports (`from "…"` / CSS `@import "…"`), not this test's own mention of the name.
    const offenders = files.filter((f) => /(from|@import)\s+["']@tailored\//.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  const posix = (f: string) => f.replaceAll("\\", "/");

  it("starts every server data module with server-only", () => {
    const offenders = files
      .filter(
        (f) =>
          /src\/lib\/[^/]+\/(scoped|store)\.ts$/.test(posix(f)) ||
          posix(f).endsWith("src/lib/realtime/broadcast.ts") ||
          posix(f).endsWith("src/lib/prisma.ts"),
      )
      .filter((f) => !readFileSync(f, "utf8").startsWith('import "server-only";'));
    expect(offenders).toEqual([]);
  });

  it("re-checks permission on the first line of every server action", () => {
    const actionFiles = files.filter((f) => posix(f).endsWith("actions.ts") && !posix(f).endsWith("src/lib/auth/actions.ts"));
    expect(actionFiles.length).toBeGreaterThan(0);
    const offenders = actionFiles.flatMap((f) =>
      readFileSync(f, "utf8")
        .split(/export async function /)
        .slice(1)
        // The signature is one line (its return type may contain braces); the body's first statement
        // must resolve the scope and check a permission.
        .filter((body) => !/^[^\n]*\n\s*const scope = await getTeamScope\(\);\s*if \(!scope \|\| !scopeCan\(scope,/.test(body))
        .map((body) => `${posix(f)}: ${body.slice(0, 40)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("uses DataTable only from client components", () => {
    // DataTable takes functions (rowKey, cell renderers), which cannot cross from a Server
    // Component — a server page that renders it crashes at runtime, not at build time.
    const offenders = files
      .filter((f) => !posix(f).startsWith("src/design/"))
      .filter((f) => /from ["']@\/design\/table["']/.test(readFileSync(f, "utf8")))
      .filter((f) => !readFileSync(f, "utf8").startsWith('"use client"'));
    expect(offenders).toEqual([]);
  });

  it("never reads app data from the browser", () => {
    const offenders = files
      .filter((f) => readFileSync(f, "utf8").includes('"use client"'))
      .filter((f) => /\.from\(["'`]/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("guards every app page with requireMember", () => {
    const pages = files.filter((f) => posix(f).includes("src/app/(app)/") && posix(f).endsWith("/page.tsx"));
    expect(pages.length).toBeGreaterThan(0);
    const offenders = pages.filter((f) => !readFileSync(f, "utf8").includes("requireMember("));
    expect(offenders).toEqual([]);
  });
});
