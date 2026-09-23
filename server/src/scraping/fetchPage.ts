import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { isUrlSafeToFetch } from "./validateUrl";
import { withRetry } from "./retryFetch";

export interface PageLink {
  text: string;
  url: string;
}

export interface FetchedPage {
  url: string;
  html: string;
  links: PageLink[];
}

async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const { origin } = new URL(url);
    const robotsUrl = `${origin}/robots.txt`;
    const response = await fetch(robotsUrl, { headers: { "User-Agent": "GetaJob-Bot/1.0" } });
    if (!response.ok) return true; // no robots.txt or inaccessible — assume allowed
    const body = await response.text();
    const robots = robotsParser(robotsUrl, body);
    return robots.isAllowed(url, "GetaJob-Bot/1.0") ?? true;
  } catch {
    return true; // if robots.txt itself can't be fetched, don't block the crawl over it
  }
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const urlCheck = isUrlSafeToFetch(url);
  if (!urlCheck.safe) {
    throw new Error(`URL rejected: ${urlCheck.reason}`);
  }

  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    throw new Error(`Crawling disallowed by robots.txt: ${url}`);
  }

    const html = await withRetry(async () => {
    const response = await fetch(url, {
      headers: { "User-Agent": "GetaJob-Bot/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error(`Unexpected content type, refusing to process: ${contentType}`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > 5_000_000) {
      throw new Error("Page too large to process (over 5MB)");
    }

    const text = await response.text();
    if (text.length > 5_000_000) {
      throw new Error("Page too large to process (over 5MB)");
    }

    return text;
  });
  
  const $ = cheerio.load(html);

  const links: PageLink[] = [];
  $("a").each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href");
    if (href && text) {
      links.push({ text, url: new URL(href, url).toString() });
    }
  });

  return { url, html, links };
}