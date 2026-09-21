"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface KitSummary {
  _id: string;
  status: string;
  createdAt: string;
  data?: { source?: { company?: string; role?: string } };
}

export default function DashboardPage() {
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function loadKits() {
    try {
      const data = await apiFetch("/kits");
      setKits(data);
    } catch {
      router.push("/login");
    }
  }

  useEffect(() => {
    loadKits();
    const interval = setInterval(loadKits, 3000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await apiFetch("/kits", {
        method: "POST",
        body: JSON.stringify({ jd, companyUrl, days: Number(days) }),
      });
      setJd("");
      setCompanyUrl("");
      loadKits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const statusStyles: Record<string, string> = {
    ready: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    failed: "bg-red-500/10 text-red-400 border border-red-500/20",
    generating: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-white mb-6">Your Interview Kits</h1>

      <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 flex flex-col gap-3">
        <h2 className="text-sm font-medium text-slate-300">Create a new kit</h2>
        <textarea
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm h-32 resize-none placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste the job description here"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          required
        />
        <input
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Company website (e.g. https://company.com)"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
          required
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400 whitespace-nowrap">Days until interview</label>
          <input
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            required
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          className="bg-blue-600 hover:bg-blue-500 transition text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={creating}
        >
          {creating ? "Starting generation..." : "Generate Kit"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {kits.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">No kits yet — create your first one above.</p>
        )}
        {kits.map((kit) => (
          <a
            key={kit._id}
            href={`/kits/${kit._id}`}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition rounded-xl p-4 flex justify-between items-center"
          >
            <div>
              <p className="font-medium text-white">{kit.data?.source?.company || "Generating..."}</p>
              {kit.data?.source?.role && (
                <p className="text-sm text-slate-400">{kit.data.source.role}</p>
              )}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[kit.status] || statusStyles.pending}`}>
              {kit.status}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}