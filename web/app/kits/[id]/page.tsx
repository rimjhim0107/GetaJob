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
  state: "generated" | "edited" | "user_added";
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  state: "generated" | "edited" | "user_added";
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

let newIdCounter = 0;
function newId(prefix: string) {
  newIdCounter++;
  return `${prefix}-new-${Date.now()}-${newIdCounter}`;
}

export default function KitDetailPage() {
  const { id } = useParams();
  const [kitDoc, setKitDoc] = useState<KitDoc | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [savedFlashcards, setSavedFlashcards] = useState<Flashcard[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

    async function load() {
    const data = await apiFetch(`/kits/${id}`);
    setKitDoc(data);
    if (data.data) {
      setQuestions(data.data.questions || []);
      setFlashcards(data.data.flashcards || []);
      setSavedQuestions(data.data.questions || []);
      setSavedFlashcards(data.data.flashcards || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (kitDoc?.status !== "generating" && kitDoc?.status !== "pending") return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [kitDoc?.status]);

    async function saveChanges() {
    setSaving(true);
    setSaveError("");
    try {
      const updated = await apiFetch(`/kits/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ questions, flashcards }),
      });
      setKitDoc(updated);
      setSavedQuestions(questions);
      setSavedFlashcards(flashcards);
      setDirty(false);
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function revertChanges() {
    setQuestions(savedQuestions);
    setFlashcards(savedFlashcards);
    setDirty(false);
    setSaveError("");
    setEditingId(null);
  }

  function updateQuestion(qid: string, patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, ...patch, state: q.state === "user_added" ? "user_added" : "edited" } : q))
    );
    setDirty(true);
  }

  function deleteQuestion(qid: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
    setDirty(true);
  }

  function addQuestion() {
    const q: Question = {
      id: newId("q"),
      prompt: "New question — click to edit",
      answer_outline: "",
      category: "technical",
      difficulty: 1,
      requirement_ids: [],
      state: "user_added",
    };
    setQuestions((prev) => [...prev, q]);
    setEditingId(q.id);
    setDirty(true);
  }

  function moveQuestion(qid: string, dir: -1 | 1) {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === qid);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
    setDirty(true);
  }

  function updateFlashcard(fid: string, patch: Partial<Flashcard>) {
    setFlashcards((prev) =>
      prev.map((f) => (f.id === fid ? { ...f, ...patch, state: f.state === "user_added" ? "user_added" : "edited" } : f))
    );
    setDirty(true);
  }

  function deleteFlashcard(fid: string) {
    setFlashcards((prev) => prev.filter((f) => f.id !== fid));
    setDirty(true);
  }

  function addFlashcard() {
    const f: Flashcard = {
      id: newId("f"),
      front: "New flashcard front — click to edit",
      back: "New flashcard back",
      requirement_ids: [],
      state: "user_added",
    };
    setFlashcards((prev) => [...prev, f]);
    setEditingId(f.id);
    setDirty(true);
  }

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
    const card = flashcards[practiceIndex];
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
        <button className="text-sm text-slate-400 hover:text-white transition mb-6" onClick={() => setPracticeMode(false)}>
          ← Back to kit
        </button>
        <p className="text-sm text-slate-500 mb-2">Card {practiceIndex + 1} of {flashcards.length}</p>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 min-h-[180px] flex flex-col justify-center">
          <p className="text-white font-medium">{card.front}</p>
          {revealed && <p className="text-slate-400 text-sm border-t border-slate-800 pt-4 mt-4">{card.back}</p>}
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
              setPracticeIndex((i) => (i + 1) % flashcards.length);
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

  const stateLabel: Record<string, string> = {
    edited: "edited",
    user_added: "added",
    generated: "",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
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
        onClick={() => { setPracticeMode(true); setPracticeIndex(0); setRevealed(false); }}
      >
        Practice with flashcards
      </button>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Requirements</h2>
        <div className="flex flex-col gap-2">
          {kit.role.requirements.map((r) => (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-slate-200">{r.text}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityStyle[r.priority]}`}>{r.priority}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Questions</h2>
          <button onClick={addQuestion} className="text-xs text-blue-400 hover:text-blue-300 transition">+ Add question</button>
        </div>
        <div className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              {editingId === q.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm text-slate-200"
                    value={q.prompt}
                    onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                  />
                  <textarea
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm text-slate-400"
                    value={q.answer_outline}
                    onChange={(e) => updateQuestion(q.id, { answer_outline: e.target.value })}
                    placeholder="Answer outline"
                  />
                  <button className="text-xs text-blue-400 self-start" onClick={() => setEditingId(null)}>Done</button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-200">{q.prompt}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {q.category} · difficulty {q.difficulty}
                    {stateLabel[q.state] && <span className="ml-2 text-blue-400">({stateLabel[q.state]})</span>}
                  </p>
                  <div className="flex gap-3 mt-2">
                    <button className="text-xs text-slate-400 hover:text-white" onClick={() => setEditingId(q.id)}>Edit</button>
                    <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteQuestion(q.id)}>Delete</button>
                    <button className="text-xs text-slate-400 hover:text-white" disabled={i === 0} onClick={() => moveQuestion(q.id, -1)}>↑</button>
                    <button className="text-xs text-slate-400 hover:text-white" disabled={i === questions.length - 1} onClick={() => moveQuestion(q.id, 1)}>↓</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Flashcards</h2>
          <button onClick={addFlashcard} className="text-xs text-blue-400 hover:text-blue-300 transition">+ Add flashcard</button>
        </div>
        <div className="flex flex-col gap-2">
          {flashcards.map((f) => (
            <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              {editingId === f.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm text-slate-200"
                    value={f.front}
                    onChange={(e) => updateFlashcard(f.id, { front: e.target.value })}
                  />
                  <textarea
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm text-slate-400"
                    value={f.back}
                    onChange={(e) => updateFlashcard(f.id, { back: e.target.value })}
                  />
                  <button className="text-xs text-blue-400 self-start" onClick={() => setEditingId(null)}>Done</button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-200">{f.front}</p>
                  {stateLabel[f.state] && <p className="text-xs text-blue-400 mt-1">({stateLabel[f.state]})</p>}
                  <div className="flex gap-3 mt-2">
                    <button className="text-xs text-slate-400 hover:text-white" onClick={() => setEditingId(f.id)}>Edit</button>
                    <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteFlashcard(f.id)}>Delete</button>
                  </div>
                </div>
              )}
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

            {dirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <p className="text-sm text-slate-400">You have unsaved changes.{saveError && <span className="text-red-400 ml-2">{saveError}</span>}</p>
            <div className="flex gap-2">
              <button
                className="border border-slate-700 hover:border-slate-600 transition text-sm text-white px-4 py-2 rounded-lg disabled:opacity-50"
                onClick={revertChanges}
                disabled={saving}
              >
                Revert
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-500 transition text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                onClick={saveChanges}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}