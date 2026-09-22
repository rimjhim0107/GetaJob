"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Question {
  id: string;
  prompt: string;
  answer_outline: string;
  category: string;
  difficulty: number;
  requirement_ids: string[];
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
}

interface Kit {
  source: { company: string; role: string; company_url: string; pages_used: string[] };
  company_brief: { summary: string; what_they_do: string; sources: string[] };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: { id: string; text: string; kind: string; priority: string }[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: { days_available: number; days: { day: number; focus: string; question_ids: string[]; minutes: number }[] };
  coverage: { uncovered_requirement_ids: string[]; passes: number };
}

interface KitDoc {
  _id: string;
  status: string;
  error?: string;
  data?: Kit;
}

export default function KitDetailPage() {
  const { id } = useParams();
  const [kitDoc, setKitDoc] = useState<KitDoc | null>(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  async function load() {
    const data = await apiFetch(`/kits/${id}`);
    setKitDoc(data);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (kitDoc?.status !== "generating" && kitDoc?.status !== "pending") return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [kitDoc?.status]);

  if (!kitDoc) {
    return <div className="max-w-2xl mx-auto px-4 py-20 text-slate-400 text-center">Loading...</div>;
  }

  if (kitDoc.status === "generating" || kitDoc.status === "pending") {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white font-medium">Generating your interview kit...</p>
        <p className="text-sm text-slate-500 mt-1">This can take up to a minute — feel free to wait here.</p>
      </div>
    );
  }

  if (kitDoc.status === "failed") {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <p className="text-red-400 font-medium">Generation failed</p>
        <p className="text-sm text-slate-500 mt-1">{kitDoc.error}</p>
      </div>
    );
  }

  const kit = kitDoc.data!;

    if (practiceMode) {
    const card = kit.flashcards[practiceIndex];
    if (!card) {
      return (
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          <button className="text-sm text-slate-400 hover:text-white transition mb-6" onClick={() => setPracticeMode(false)}>
            ← Back to kit
          </button>
          <p className="text-slate-400">No flashcards available for this kit.</p>
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <button
          className="text-sm text-slate-400 hover:text-white transition mb-6"
          onClick={() => setPracticeMode(false)}
        >
          ← Back to kit
        </button>
        <p className="text-sm text-slate-500 mb-2">Card {practiceIndex + 1} of {kit.flashcards.length}</p>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 min-h-[180px] flex flex-col justify-center">
          <p className="text-white font-medium">{card.front}</p>
          {revealed && (
            <p className="text-slate-400 text-sm border-t border-slate-800 pt-4 mt-4">{card.back}</p>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            className="border border-slate-700 hover:border-slate-600 transition text-sm text-white px-4 py-2 rounded-lg"
            onClick={() => setRevealed(!revealed)}
          >
            {revealed ? "Hide answer" : "Reveal answer"}
          </button>
          <button
            className="bg-blue-600 hover:bg-blue-500 transition text-sm text-white px-4 py-2 rounded-lg"
            onClick={() => {
              setRevealed(false);
              setPracticeIndex((i) => (i + 1) % kit.flashcards.length);
            }}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  const priorityStyle: Record<string, string> = {
    must: "bg-red-500/10 text-red-400 border border-red-500/20",
    nice: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-white capitalize">{kit.source.company}</h1>
            {kit.source.role && <p className="text-slate-400 mb-6">{kit.source.role}</p>}

      {(kit.company_brief.summary || kit.company_brief.what_they_do) && (
        <section className="mb-8 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Company Brief</h2>
          {kit.company_brief.summary && <p className="text-sm text-slate-300 mb-2">{kit.company_brief.summary}</p>}
          {kit.company_brief.what_they_do && <p className="text-sm text-slate-400">{kit.company_brief.what_they_do}</p>}
        </section>
      )}

      <button
        className="bg-blue-600 hover:bg-blue-500 transition text-white text-sm font-medium px-4 py-2 rounded-lg mb-8"
        onClick={() => setPracticeMode(true)}
      >
        Practice with flashcards
      </button>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Requirements</h2>
        <div className="flex flex-col gap-2">
          {kit.role.requirements.map((r) => (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-slate-200">{r.text}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityStyle[r.priority]}`}>
                {r.priority}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Questions</h2>
        <div className="flex flex-col gap-2">
          {kit.questions.map((q) => (
            <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-200">{q.prompt}</p>
              <p className="text-xs text-slate-500 mt-2">{q.category} · difficulty {q.difficulty}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Study Schedule</h2>
        <div className="flex flex-col gap-2">
          {kit.schedule.days.map((d) => (
            <div key={d.day} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-sm text-slate-200 font-medium">Day {d.day}: {d.focus}</p>
              <p className="text-xs text-slate-500">{d.question_ids.length} questions · {d.minutes} minutes</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}