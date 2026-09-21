"use client";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const hideOn = ["/login", "/register"];
  if (hideOn.includes(pathname)) return null;

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
        <a href="/dashboard" className="font-semibold text-lg text-white tracking-tight">
          GetaJob
        </a>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-400 hover:text-white transition"
        >
          Log out
        </button>
      </div>
    </header>
  );
}