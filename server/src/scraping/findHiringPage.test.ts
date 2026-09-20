import { describe, it, expect } from "vitest";
import { findHiringPageCandidates } from "./findHiringPage";
import type { PageLink } from "./fetchPage";

describe("findHiringPageCandidates", () => {
  it("ranks a link with 'careers' in the text as a candidate", () => {
    const links: PageLink[] = [
      { text: "About Us", url: "https://example.com/about" },
      { text: "Careers", url: "https://example.com/careers" },
    ];

    const result = findHiringPageCandidates(links);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/careers");
  });

  it("returns an empty array when no links match hiring keywords", () => {
    const links: PageLink[] = [
      { text: "About Us", url: "https://example.com/about" },
      { text: "Contact", url: "https://example.com/contact" },
    ];

    expect(findHiringPageCandidates(links)).toEqual([]);
  });

  it("removes duplicate URLs from the results", () => {
    const links: PageLink[] = [
      { text: "Jobs", url: "https://example.com/jobs" },
      { text: "Jobs", url: "https://example.com/jobs" },
    ];

    expect(findHiringPageCandidates(links)).toHaveLength(1);
  });

  it("ranks a link matching multiple keywords higher than one matching one", () => {
    const links: PageLink[] = [
      { text: "Careers", url: "https://example.com/careers" },
      { text: "We're hiring - join our team", url: "https://example.com/join" },
    ];

    const result = findHiringPageCandidates(links);
    // the second link matches both "hiring" and "join" keywords, so it should rank first
    expect(result[0].url).toBe("https://example.com/join");
  });
});