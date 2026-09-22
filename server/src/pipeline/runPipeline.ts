import { extractRequirements } from "./extractRequirements";
import { generateQuestionsForRequirement } from "./generateQuestions";
import { fetchPage } from "../scraping/fetchPage";
import { findHiringPageCandidates } from "../scraping/findHiringPage";
import { searchPublicDiscussion } from "../scraping/searchPublicDiscussion";
import { checkCoverage } from "../scheduling/checkCoverage";
import { buildSchedule } from "../scheduling/buildSchedule";
import { generateCompanyBrief } from "./generateCompanyBrief";
import { extractRoleInfo } from "./extractRoleInfo";
import { generateFlashcardsForRequirement } from "./generateFlashcards";
import type { Flashcard, Kit, Question } from "../schemas/kit.schema";

interface PipelineInput {
  jd: string;
  companyUrl: string;
  days: number;
}

function getCompanyNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const parts = hostname.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  } catch {
    return "Unknown";
  }
}

export async function runPipeline(input: PipelineInput): Promise<Kit> {
  const { jd, companyUrl, days } = input;
  const pagesUsed: string[] = [];

  // Step 1: extract requirements from the pasted JD — no dependency on anything else
    // Step 1: extract requirements and role info from the pasted JD — no dependency on anything else
  const requirements = await extractRequirements(jd);
  const roleInfo = await extractRoleInfo(jd);

  // Step 2: crawl the company site to find a hiring page, if one exists
    // Step 2: crawl the company site to find a hiring page, if one exists
  let hiringPageContent = "";
  let companySiteReachable = false;
  try {
    const homepage = await fetchPage(companyUrl);
    companySiteReachable = true;
    pagesUsed.push(companyUrl);
    const candidates = findHiringPageCandidates(homepage.links);

    if (candidates.length > 0) {
      const hiringPage = await fetchPage(candidates[0].url);
      pagesUsed.push(candidates[0].url);
      hiringPageContent = hiringPage.html;
    }
  } catch (err) {
    console.warn(`Could not crawl company site: ${err}`);
  }

  // Step 3: search for public discussion — skip if the company site itself
  // was unreachable, since that's a strong signal the company/URL isn't real,
  // and searching would only return irrelevant noise, not genuine discussion.
    const companyName = getCompanyNameFromUrl(companyUrl);
  let discussionSources: string[] = [];
  let discussionSnippets: string[] = [];
  if (companySiteReachable) {
    try {
      const discussion = await searchPublicDiscussion(companyName);
      discussionSources = discussion.map((d) => d.url);
      discussionSnippets = discussion.map((d) => d.snippet);
    } catch (err) {
      console.warn(`Public discussion search failed: ${err}`);
    }
  }

  // Step 3b: generate the company brief from whatever we found
  const companyBrief = await generateCompanyBrief(companyName, hiringPageContent, discussionSnippets);

  // Step 4: generate questions per requirement (first pass)
    // Step 4: generate questions and flashcards per requirement (first pass)
  let questions: Question[] = [];
  let flashcards: Flashcard[] = [];
  for (const req of requirements) {
    const generatedQuestions = await generateQuestionsForRequirement(req);
    questions.push(...generatedQuestions);
    const generatedFlashcards = await generateFlashcardsForRequirement(req);
    flashcards.push(...generatedFlashcards);
  }

  // Step 5: check coverage, generate missing questions for gaps (second pass)
  let uncovered = checkCoverage(requirements, questions);
  let passes = 1;
  const maxPasses = 2;

  while (uncovered.length > 0 && passes < maxPasses) {
    for (const reqId of uncovered) {
      const req = requirements.find((r) => r.id === reqId);
      if (req) {
        const generated = await generateQuestionsForRequirement(req);
        questions.push(...generated);
      }
    }
    uncovered = checkCoverage(requirements, questions);
    passes++;
  }

  // Step 6: build the schedule — deterministic, runs last
  const scheduleDays = buildSchedule(requirements, questions, days);

    return {
    source: {
      company: companyName,
      company_url: companyUrl,
      role: roleInfo.title,
      location: "",
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: pagesUsed,
    },
    company_brief: {
      summary: companyBrief.summary,
      what_they_do: companyBrief.what_they_do,
      sources: discussionSources,
    },
    role: {
      title: roleInfo.title,
      seniority: roleInfo.seniority,
      responsibilities: roleInfo.responsibilities,
      requirements,
    },
    questions,
    flashcards,
    schedule: {
      days_available: days,
      days: scheduleDays,
    },
    coverage: {
      uncovered_requirement_ids: uncovered,
      passes,
    },
  };
}