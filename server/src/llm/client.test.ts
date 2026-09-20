import { describe, it, expect } from "vitest";
import { getBackoffDelay } from "./client";

describe("getBackoffDelay", () => {
  it("doubles the wait time with each attempt", () => {
    expect(getBackoffDelay(1)).toBe(2000);
    expect(getBackoffDelay(2)).toBe(4000);
    expect(getBackoffDelay(3)).toBe(8000);
  });
});