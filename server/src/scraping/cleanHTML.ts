import * as cheerio from "cheerio";

export function cleanHtml(html: string, maxLength = 3000): string {
  const $ = cheerio.load(html);

  // remove elements that never contain useful readable content
  $("script, style, nav, footer, header, noscript, svg, img").remove();

  const text = $("body").text();

  // collapse excessive whitespace left behind by removed elements
  const cleaned = text.replace(/\s+/g, " ").trim();

  return cleaned.slice(0, maxLength);
}