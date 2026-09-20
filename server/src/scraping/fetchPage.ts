import * as cheerio from "cheerio";

export interface PageLink {
  text: string;
  url: string;
}

export interface FetchedPage {
  url: string;
  html: string;
  links: PageLink[];
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const response = await fetch(url, {
    headers: { "User-Agent": "GetaJob-Bot/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  const html = await response.text();
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