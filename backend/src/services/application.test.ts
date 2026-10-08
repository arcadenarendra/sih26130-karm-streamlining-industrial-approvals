import { describe, expect, it } from "vitest";
import { overall } from "./application.js";
describe("overall status", () => {
  it("prioritizes rejection and action required", () => {
    expect(overall(["approved", "rejected"])).toBe("rejected");
    expect(overall(["approved", "query_raised"])).toBe("action_required");
    expect(overall(["approved", "approved"])).toBe("approved");
  });
});
