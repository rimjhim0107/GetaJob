import { tavily } from "@tavily/core";
import dotenv from "dotenv";

dotenv.config();

const client = tavily({ apiKey: process.env.SEARCH_API_KEY });

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchPublicDiscussion(company: string): Promise<SearchResult[]> {
  const response = await client.search(`${company} interview process questions`, {
    maxResults: 5,
  });

  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }));
}