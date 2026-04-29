import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export const metadata = { title: "Terms of Service — SnapList" };

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted mb-10">Last Updated: April 2026</p>

        <div className="prose-legal space-y-8 text-sm leading-relaxed text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Overview</h2>
            <p>
              This platform provides an AI-assisted visual identification tool for trading cards
              and optional listing support for third-party marketplaces. By using the service,
              you agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Nature of the Service</h2>
            <p>
              We provide a tool only. We do NOT authenticate or certify trading cards. We do NOT
              guarantee identification accuracy. We do NOT act as a broker, dealer, or marketplace.
              We are NOT affiliated with any third-party platforms including eBay, TCGPlayer, or
              any trading card game publisher.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. User Responsibility</h2>
            <p>
              You are solely responsible for verifying all card details before listing or selling,
              ensuring the authenticity of items, and complying with marketplace rules and applicable
              laws. You agree not to rely solely on the platform for financial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. No Accuracy Guarantee</h2>
            <p>
              The identification results are generated using automated systems and may be incorrect.
              We make NO warranties regarding accuracy, completeness, or reliability of results.
              Confidence scores are estimates and should not be treated as guarantees.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, we are not liable for financial losses,
              misidentified items, marketplace disputes, or lost profits. Our total liability is
              limited to the amount you paid in the last 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Subscription &amp; Billing</h2>
            <p>
              Subscriptions renew automatically at the end of each billing period. You may cancel
              at any time via your account dashboard. Cancellation takes effect at the end of the
              current billing period. Fees are non-refundable unless otherwise stated.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Termination</h2>
            <p>
              We reserve the right to suspend or terminate accounts for fraudulent activity,
              violation of policies, or misuse of the platform. You may delete your account at
              any time through your settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>
              All platform content and software are owned by us. You grant us a limited license
              to process uploaded images solely to provide the identification service. We do not
              claim ownership of your uploaded content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Third-Party Services</h2>
            <p>
              We are not responsible for eBay, TCGPlayer, or other marketplaces, third-party
              integrations, or external transactions. Use of marketplace features is subject to
              those platforms&apos; own terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Changes to Terms</h2>
            <p>
              We may update these Terms at any time. Continued use of the service after changes
              constitutes acceptance. We will notify users of material changes via email or
              in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of Puerto Rico.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex gap-4 text-xs text-muted">
          <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link href="/acceptable-use" className="hover:text-white">Acceptable Use</Link>
          <Link href="/" className="hover:text-white">Home</Link>
        </div>
      </main>
    </div>
  );
}
