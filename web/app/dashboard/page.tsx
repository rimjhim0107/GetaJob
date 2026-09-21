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
    const interval = setInterval(loadKits, 3000); // poll for status updates
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

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6">
      <h1 className="text-2xl font-bold mb-6">Your Interview Kits</h1>

      <form onSubmit={handleCreate} className="border rounded p-4 mb-8 flex flex-col gap-3">
        <h2 className="font-semibold">Create a new kit</h2>
        <textarea
          className="border p-2 rounded h-32"
          placeholder="Paste the job description here"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          required
        />
        <input
          className="border p-2 rounded"
          placeholder="Company website (e.g. https://company.com)"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
          required
        />
        <input
          className="border p-2 rounded"
          type="number"
          min={1}
          max={60}
          placeholder="Days until interview"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="bg-black text-white p-2 rounded disabled:opacity-50" disabled={creating}>
          {creating ? "Starting generation..." : "Generate Kit"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {kits.length === 0 && <p className="text-gray-500">No kits yet.</p>}
        {kits.map((kit) => (
          <a
            key={kit._id}
            href={`/kits/${kit._id}`}
            className="border rounded p-4 flex justify-between items-center hover:bg-gray-50"
          >
            <div>
              <p className="font-medium">{kit.data?.source?.company || "Generating..."}</p>
              <p className="text-sm text-gray-500">{kit.data?.source?.role || "—"}</p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded ${
                kit.status === "ready" ? "bg-green-100 text-green-700" :
                kit.status === "failed" ? "bg-red-100 text-red-700" :
                "bg-yellow-100 text-yellow-700"
              }`}
            >
              {kit.status}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}