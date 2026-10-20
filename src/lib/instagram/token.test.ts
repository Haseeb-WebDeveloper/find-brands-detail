import { afterEach, describe, expect, it } from "vitest";
import { metaTokenStatus } from "@/lib/instagram/token";

afterEach(() => {
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_IG_USER_ID;
  delete process.env.META_TOKEN_EXPIRES_AT;
});

describe("metaTokenStatus", () => {
  const now = new Date("2026-10-21T00:00:00Z");

  it("warns when nothing is configured", () => {
    expect(metaTokenStatus(now)).toEqual({ configured: false, expiresAt: null, daysLeft: null, warn: true });
  });

  it("is quiet with weeks left", () => {
    process.env.META_ACCESS_TOKEN = "t";
    process.env.META_IG_USER_ID = "1";
    process.env.META_TOKEN_EXPIRES_AT = "2026-12-15T00:00:00Z";
    expect(metaTokenStatus(now)).toMatchObject({ configured: true, daysLeft: 55, warn: false });
  });

  it("warns in the last week and after expiry", () => {
    process.env.META_ACCESS_TOKEN = "t";
    process.env.META_IG_USER_ID = "1";
    process.env.META_TOKEN_EXPIRES_AT = "2026-10-26T00:00:00Z";
    expect(metaTokenStatus(now)).toMatchObject({ daysLeft: 5, warn: true });
    process.env.META_TOKEN_EXPIRES_AT = "2026-10-01T00:00:00Z";
    expect(metaTokenStatus(now)).toMatchObject({ daysLeft: -20, warn: true });
  });
});
