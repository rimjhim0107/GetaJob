import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isUrlSafeToFetch } from "./validateUrl";

describe("isUrlSafeToFetch", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("rejects loopback addresses in production", () => {
    expect(isUrlSafeToFetch("http://localhost:3000").safe).toBe(false);
    expect(isUrlSafeToFetch("http://127.0.0.1").safe).toBe(false);
  });

  it("rejects private IP ranges in production", () => {
    expect(isUrlSafeToFetch("http://10.0.0.5").safe).toBe(false);
    expect(isUrlSafeToFetch("http://192.168.1.1").safe).toBe(false);
    expect(isUrlSafeToFetch("http://172.16.0.1").safe).toBe(false);
  });

  it("allows public URLs in production", () => {
    expect(isUrlSafeToFetch("https://gitlab.com").safe).toBe(true);
  });

  it("rejects non-http(s) protocols", () => {
    expect(isUrlSafeToFetch("file:///etc/passwd").safe).toBe(false);
  });

  it("allows localhost when not in production (for the batch command's local test fixtures)", () => {
    process.env.NODE_ENV = "development";
    expect(isUrlSafeToFetch("http://localhost:8099").safe).toBe(true);
  });
});