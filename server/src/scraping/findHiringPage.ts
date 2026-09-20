import type { PageLink } from "./fetchPage";

const HIRING_KEYWORDS = [
  "careers",
  "jobs",
  "hiring",
  "join us",
  "join our team",
  "work with us",
  "we're hiring",
  "open positions",
  "life at",
];

function scoreLink(link: PageLink): number {
  const combined = `${link.text} ${link.url}`.toLowerCase();
  let score = 0;

  for (const keyword of HIRING_KEYWORDS) {
    if (combined.includes(keyword)) {
      score += 1;
    }
  }

  return score;
}

export function findHiringPageCandidates(links: PageLink[]): PageLink[] {
  const scored = links
    .map((link) => ({ link, score: scoreLink(link) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  // deduplicate by URL, keeping the first (highest-scored) occurrence
  const seen = new Set<string>();
  const deduped: PageLink[] = [];
  for (const entry of scored) {
    if (!seen.has(entry.link.url)) {
      seen.add(entry.link.url);
      deduped.push(entry.link);
    }
  }

  return deduped;
}