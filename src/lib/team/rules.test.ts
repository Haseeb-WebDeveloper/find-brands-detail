import { describe, expect, it } from "vitest";
import { removalProblem, roleChangeProblem } from "@/lib/team/rules";

describe("removalProblem", () => {
  it("refuses removing yourself", () => {
    expect(removalProblem({ actorId: "a", targetId: "a", targetRole: "owner", ownerCount: 2 })).toBe("You can't remove yourself.");
  });

  it("refuses removing the last owner", () => {
    expect(removalProblem({ actorId: "a", targetId: "b", targetRole: "owner", ownerCount: 1 })).toBe("The team needs at least one owner.");
  });

  it("allows removing a member", () => {
    expect(removalProblem({ actorId: "a", targetId: "b", targetRole: "member", ownerCount: 1 })).toBeNull();
  });
});

describe("roleChangeProblem", () => {
  it("refuses demoting the last owner, including yourself", () => {
    expect(roleChangeProblem({ actorId: "a", targetId: "a", from: "owner", to: "member", ownerCount: 1 })).toBe("The team needs at least one owner.");
  });

  it("allows changes when another owner remains", () => {
    expect(roleChangeProblem({ actorId: "a", targetId: "b", from: "member", to: "owner", ownerCount: 1 })).toBeNull();
    expect(roleChangeProblem({ actorId: "a", targetId: "b", from: "owner", to: "member", ownerCount: 2 })).toBeNull();
  });

  it("treats no change as fine", () => {
    expect(roleChangeProblem({ actorId: "a", targetId: "b", from: "member", to: "member", ownerCount: 1 })).toBeNull();
  });
});
