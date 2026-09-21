# GetaJob — AI Interview Prep Kit

This is my submission for the Trao full-stack AI interview assessment. You paste in a job description, give it a company's website, and say how many days you have until the interview — the app then researches the company, figures out what the role actually requires, generates a bank of interview questions, checks that it hasn't missed anything important, and lays out a day-by-day study plan.

## Table of Contents
- [What it does](#what-it-does)
- [Tech stack and why](#tech-stack-and-why)
- [Running it locally](#running-it-locally)
- [Architecture](#architecture)
- [How the research actually works](#how-the-research-actually-works)
- [Why the steps run in this order](#why-the-steps-run-in-this-order)
- [The builder / edit state](#the-builder--edit-state)
- [How the schedule gets built](#how-the-schedule-gets-built)
- [What's missing / what I'd fix with more time](#whats-missing--what-id-fix-with-more-time)

## What it does

User registers, pastes a JD, gives a company URL and a day count, and hits generate. The app then:
1. Pulls the actual requirements out of the JD (not invented ones)
2. Crawls the company's site looking for a careers/hiring page
3. Searches for public discussion of their interview process
4. Generates questions for each requirement, checks nothing's uncovered, fills any gaps
5. Builds a study schedule across however many days they said

Once it's ready you can look through the requirements, questions, and schedule, and practice against the questions flashcard-style.

## Tech stack and why

I mostly stuck with what the brief suggested (Next.js + Express + MongoDB) rather than going out of my way to use something different, since there wasn't a strong reason to deviate.

A few choices worth explaining:

**Zod for validation** — I hadn't used it before this assignment, but the idea is simple enough: you write one schema and get both a runtime validator and the matching TypeScript type out of it, so I'm not keeping two versions of "what a Kit looks like" in sync by hand. Given the brief requires validating a generated kit against the expected structure before saving it, this made sense.

**Groq for the LLM** — genuinely free, fast, and I could actually check what models were available on my account instead of guessing from documentation (`client.models.list()`), which turned out to matter since a couple of model names I initially tried didn't exist anymore.

**Tavily for the interview-discussion search** — I originally tried scraping DuckDuckGo's HTML results directly with Cheerio (no API key needed), but it got flagged as bot traffic almost immediately (status 202, anomaly-detection challenge page). I'd also looked at Brave's search API, but their free tier was discontinued earlier this year and now needs a card on file, which conflicts with the brief saying nothing here should cost money. Tavily's free tier is 1,000 requests/month with no card required, so I switched to that.

**Session-based auth, not JWT** — sessions live in MongoDB via connect-mongo, mainly because Render's free tier spins the server down when idle, and I wanted sessions to survive that rather than living only in memory.

## Running it locally

Backend:
```bash
cd server
npm install
# copy .env.example to .env, fill in real values
npm run dev
```

Frontend:
```bash
cd web
npm install
# create .env.local with NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev
```

### Batch command

```bash
cd server
npm run evaluate -- --input <cases.json> --output <kits.json>
```

One thing worth flagging: on Windows, there's a known npm bug where flags after `--` get silently stripped (npm/cli#9353) — I hit this myself during development. If it happens, doubling the `--` works around it:
```bash
npm run evaluate -- -- --input <cases.json> --output <kits.json>
```
This is a Windows/npm issue, not something wrong with the script — it runs fine as written on Mac/Linux.

### Env vars

`MONGODB_URI`, `SESSION_SECRET`, `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `SEARCH_API_KEY` all live in `server/.env`. The frontend just needs `NEXT_PUBLIC_API_URL` pointing at wherever the backend is running.

Deployed: frontend on Vercel (root dir `web`), backend on Render (root dir `server`, build command `npm install --include=dev && npm run build` — note the `--include=dev`, without it TypeScript itself doesn't get installed because Render sets `NODE_ENV=production` before the install step, which makes npm skip devDependencies).

## Architecture

```
Next.js (Vercel)  --HTTPS + session cookie-->  Express API (Render)
                                                      |
                                        -------------------------------
                                        |              |               |
                                   MongoDB Atlas    Groq LLM      Company sites
                                   (users, kits)    + Tavily      (crawled)
```

Backend layout, roughly in the order things get built up:

```
server/src/
  schemas/       Zod schema for the required kit structure, plus a shared validateKit() helper
  scheduling/    checkCoverage + buildSchedule — pure functions, no LLM involved
  llm/           the Groq client wrapper (retry/backoff, temperature, reasoning settings)
  pipeline/      extractRequirements, generateQuestions, and runPipeline (the orchestrator)
  scraping/      fetchPage, findHiringPageCandidates, searchPublicDiscussion
  models/        Mongoose models for User and Kit
  routes/        auth.ts and kits.ts — thin route handlers
  middleware/    requireAuth
  scripts/       evaluate.ts, the batch entry point
```

The route handler for `POST /kits` and `scripts/evaluate.ts` both call the same `runPipeline()` function. I built it this way specifically because the brief says the batch command has to run "the same code your application uses, not a parallel implementation" — so there's exactly one place the actual pipeline logic lives.

Generation runs in the background, not inline in the HTTP request — a full run can take anywhere from 10 seconds to over a minute depending on how many requirements come back and whether the crawl succeeds, and that's too long to hold an HTTP connection open reliably. `POST /kits` creates a kit record with status `"generating"`, kicks off the pipeline without waiting on it, and returns immediately. The frontend polls every few seconds until the status flips to `"ready"` or `"failed"`.

## How the research actually works

The job description is just pasted text — I didn't build any scraping for it, since the brief specifically says not to (most job boards block that anyway).

The company URL is where the actual scraping happens. I fetch the homepage, pull every link off the page, and score each one against a list of keywords ("careers", "jobs", "hiring", "join us", "life at", etc.) checked against both the link text and the URL itself. Whatever scores highest becomes the hiring page candidate. I tested this against GitLab specifically since the brief mentions them as a company with a real, findable hiring page, and it correctly found `about.gitlab.com/jobs/` without me hardcoding that path anywhere.

For interview discussion, I search Tavily for `"{company} interview process questions"`. If the company site itself couldn't even be reached, I skip this search entirely — I noticed early on that searching for a made-up company name still returned results (random Reddit posts, an unrelated LinkedIn post), which would have made a completely fake company look like it had been genuinely researched. Skipping the search when there's nothing real to find felt more honest than including noise.

Every one of these steps is wrapped in a try/catch. If a company's site is down or the URL is garbage, the pipeline logs it and moves on rather than failing the whole kit — that's directly from the brief's "skip and report a source that cannot be retrieved" instruction.

## Why the steps run in this order

1. Pull requirements out of the JD first — it doesn't depend on anything else, so there's no reason to wait.
2. Crawl the homepage, then immediately look for the hiring page — these two are really one step split in two, since the second literally needs the first's output (the list of links).
3. Search for interview discussion, but only if step 2 actually reached the site.
4. Generate questions one requirement at a time, not all at once from a single prompt. This was a specific point in the brief — a requirement like "5 years of React" should produce different questions than "mentors junior engineers," and calling the model separately for each one is what actually makes that distinction happen instead of everything blurring together.
5. Check coverage — plain code, no model involved, just checking which requirement ids never show up in any question's `requirement_ids`.
6. If there are gaps, generate more questions just for those, then check again. I capped this at two passes total so it can't loop forever if something's persistently uncovered.
7. Build the schedule last, once I actually know the final list of questions.

Steps 5 and 7 are both plain functions with tests — the brief was explicit that these shouldn't be handed to the model, and honestly it made more sense to me too since they're just arithmetic and set comparison, not anything that benefits from an LLM's judgment.

## The builder / edit state

I'll be upfront — I didn't get to build this part in the UI. The brief calls this "the hardest state problem in the assessment," and my plan for it (which I didn't have time to wire up) was: give every question and flashcard a `state` field — `generated`, `edited`, or `user_added`. Regenerating a section would only touch items still marked `generated`; anything a person edited or added by hand would be left alone. Right now the kit view is read-only apart from practice mode.

## How the schedule gets built

Every question gets sorted by one rule: is it tied to a `must` requirement or a `nice` one, and within that, how difficult is it. Must-priority questions all come before nice-priority ones; within the same priority, harder questions come first. Then I just split that sorted list evenly across however many days were requested, giving any leftover questions to the earlier days rather than the last one — so day 1 might get one extra question instead of it landing randomly.

I went back and forth on this — my first instinct was that a hard-but-optional question shouldn't necessarily beat an easy-but-required one, and I ended up deciding priority should win first, difficulty only breaks ties within the same priority tier. Someone could reasonably argue the opposite; I picked this because covering the required stuff felt like it should matter more than tackling the hardest thing in the pile.

## What's missing / what I'd fix with more time

- **The builder isn't wired up.** This is the biggest gap. The state-tracking approach above is designed but not implemented in the frontend.
- **Flashcards and questions are currently the same thing** — practice mode just reuses the question bank rather than having its own generated flashcards. I'd separate these if I had more time.
- **Cross-domain cookies were fiddlier than expected.** Since the frontend and backend live on different domains (Vercel vs Render), I had to explicitly set `app.set("trust proxy", 1)` on Express and mark the session cookie `sameSite: "none"` in production, or the session would silently never get set. It works now, but a same-origin setup or token-based auth would avoid this whole class of problem.
- **Only 4 questions per requirement.** I could generate more, but each one is a real LLM call, and I wanted to stay comfortably inside Groq's free-tier rate limits rather than risk a generation failing partway through right before I needed to submit.
- **Company name is guessed from the URL** (second-to-last part of the hostname, so `about.gitlab.com` → `gitlab`), which works for the cases I tried but isn't bulletproof against every possible domain structure.
- **One debugging note worth mentioning:** the model I ended up using, `openai/gpt-oss-20b`, is a reasoning model, and early on it burned its entire token budget "thinking" in circles about an ambiguous rule in my own extraction prompt, without ever producing an answer. Fixed by lowering `reasoning_effort` to `"low"`, setting `temperature: 0`, and rewriting the prompt rule so it wasn't self-contradictory anymore.
