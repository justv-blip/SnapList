import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export const metadata = { title: "Acceptable Use Policy — SnapList" };

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-bg text-white">
      <header className="border-b border-border bg-panel">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-muted hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <span className="font-semibold text-sm">SnapList</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Acceptable Use Policy</h1>
        <p className="text-sm text-muted mb-10">Last Updated: April 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Prohibited Activities</h2>
            <p className="mb-4">You agree NOT to use the platform to:</p>
            <div className="space-y-2 ml-1">
              <p><span className="text-danger font-medium mr-2">&times;</span> Upload or process counterfeit trading cards</p>
              <p><span className="text-danger font-medium mr-2">&times;</span> Facilitate fraud or create deceptive listings</p>
              <p><span className="text-danger font-medium mr-2">&times;</span> Upload images of stolen or illegally obtained goods</p>
              <p><span className="text-danger font-medium mr-2">&times;</span> Manipulate images to deceive buyers or the identification system</p>
              <p><span className="text-danger font-medium mr-2">&times;</span> Violate marketplace rules of any connected platform</p>
              <p><span className="text-danger font-medium mr-2">&times;</span> Misrepresent card condition, authenticity, or value</p>
              <p><span className="text-danger font-medium mr-2">&times;</span> Use the service for any unlawful purpose</p>
              <p><span className="text-danger font-medium mr-2">&times;</span> Attempt to reverse-engineer, scrape, or abuse the identification system</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Enforcement</h2>
            <p>
              We reserve the right to remove content, suspend or terminate accounts, and report
              illegal activity to the appropriate authorities. Violations may result in immediate
              account termination without refund.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Your Responsibility</h2>
            <p>
              This platform is an AI-assisted identification tool. All identification results
              should be verified by the user before any financial transaction. You are responsible
              for the accuracy of your marketplace listings regardless of what our tool suggests.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Reporting Violations</h2>
            <p>
              If you encounter misuse of the platform, please report it to: <span className="text-accent">abuse@snaplistapp.app</span>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex gap-4 text-xs text-muted">
          <Link href="/terms" className="hover:text-white">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link href="/" className="hover:text-white">Home</Link>
        </div>
      </main>
    </div>
  );
}
