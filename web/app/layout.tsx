import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "GetaJob — Interview Prep Kit",
  description: "Turn a job description into a personalised interview prep kit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}