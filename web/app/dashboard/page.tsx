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
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
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
    if (days < 1 || days > 60) {
    setError("Days must be between 1 and 60");
    return;
  }
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

  function parseCsv(text: string): { jd: string; company_url: string; days: number }[] {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

    // Simple CSV parser handling quoted fields (so commas inside a JD don't break parsing)
    function parseLine(line: string): string[] {
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          fields.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      fields.push(current);
      return fields.map((f) => f.trim());
    }

    const header = parseLine(lines[0]).map((h) => h.toLowerCase());
    const jdIdx = header.indexOf("jd");
    const urlIdx = header.indexOf("company_url");
    const daysIdx = header.indexOf("days");

    if (jdIdx === -1 || urlIdx === -1 || daysIdx === -1) {
      throw new Error("CSV header must include columns: jd, company_url, days");
    }

    return lines.slice(1).map((line) => {
      const fields = parseLine(line);
      return { jd: fields[jdIdx], company_url: fields[urlIdx], days: Number(fields[daysIdx]) || 5 };
    });
  }

  async function handleBulkUpload() {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkMessage("");
    setError("");
    try {
      const text = await bulkFile.text();
      const isCsv = bulkFile.name.toLowerCase().endsWith(".csv");
      const cases = isCsv ? parseCsv(text) : JSON.parse(text);

      if (!Array.isArray(cases)) {
        throw new Error("File must contain an array of { jd, company_url, days } entries");
      }

      const result = await apiFetch("/kits/bulk", {
        method: "POST",
        body: JSON.stringify({ cases }),
      });
      setBulkMessage(`Started generating ${result.created.length} kit(s).`);
      setBulkFile(null);
      loadKits();
      setTimeout(() => setBulkMessage(""), 6000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkUploading(false);
    }
  }

  async function deleteKit(kitId: string, e: React.MouseEvent) {
    e.preventDefault(); // prevent navigating into the kit since this button sits inside the <a>
    e.stopPropagation();
    if (!confirm("Delete this kit? This cannot be undone.")) return;
    try {
      await apiFetch(`/kits/${kitId}`, { method: "DELETE" });
      loadKits();
    } catch (err: any) {
      setError(err.message);
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
            onChange={(e) => {
  const val = e.target.value.replace(/^0+(?=\d)/, "");
  setDays(val === "" ? 0 : Number(val));
}}
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

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-medium text-slate-300 mb-2">Prepare for multiple roles at once</h2>
        <p className="text-xs text-slate-500 mb-3">
          Upload a CSV or JSON file with columns/fields <code className="text-slate-400">jd</code>,{" "}
          <code className="text-slate-400">company_url</code>, and <code className="text-slate-400">days</code>. Max 10 per upload.
          A CSV can be made in Excel or Google Sheets — just export as .csv.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
            className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-800 file:text-white hover:file:bg-slate-700 file:cursor-pointer cursor-pointer"
          />
          <button
            onClick={handleBulkUpload}
            disabled={!bulkFile || bulkUploading}
            className="bg-slate-800 hover:bg-slate-700 transition text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {bulkUploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {bulkMessage && <p className="text-sm text-emerald-400 mt-2">{bulkMessage}</p>}
      </div>

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
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[kit.status] || statusStyles.pending}`}>
                {kit.status}
              </span>
              <button
                onClick={(e) => deleteKit(kit._id, e)}
                className="text-xs text-slate-500 hover:text-red-400 transition"
                title="Delete kit"
              >
                Delete
              </button>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}