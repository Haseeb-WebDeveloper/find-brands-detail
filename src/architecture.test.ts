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
});
