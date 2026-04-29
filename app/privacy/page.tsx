import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export const metadata = { title: "Privacy Policy — SnapList" };

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted mb-10">Last Updated: April 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>
              We collect account information (email address, display name), uploaded images of
              trading cards, usage data (scan counts, feature usage), and payment information
              processed securely through Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Data</h2>
            <p>
              We use your data to provide the card identification service, process your
              subscriptions, improve system performance and accuracy, maintain platform security,
              and communicate service updates.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Storage &amp; Security</h2>
            <p>
              Your data is stored on secure servers with encryption in transit (HTTPS) and at rest.
              We take reasonable steps to protect your information but cannot guarantee absolute
              security. We do not guarantee data permanence and recommend keeping your own records.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Your Rights</h2>
            <p>
              Depending on your location, you may have the right to access your data, request
              deletion of your data, request correction of inaccurate data, export your data in a
              portable format, and withdraw consent for data processing. To exercise these rights,
              contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Sharing</h2>
            <p>
              We do NOT sell personal data. We may share data with service providers (hosting,
              payment processing) who are bound by confidentiality obligations, and with legal
              authorities if required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Uploaded Images</h2>
            <p>
              Card images you upload are processed by our AI identification system. Images may
              contain metadata. We use uploaded images solely to provide the identification service
              and do not use them for unrelated purposes without your consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. International Users</h2>
            <p>
              By using the service, you consent to data transfer and processing in applicable
              jurisdictions. We comply with applicable data protection regulations including GDPR
              (for European users) and CCPA (for California residents).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Data Retention</h2>
            <p>
              We retain data only as long as necessary to provide the service. When you delete your
              account, we remove your personal data within 30 days. Some data may be retained longer
              where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Cookies &amp; Analytics</h2>
            <p>
              We use essential cookies for authentication and session management. We may use
              analytics to understand usage patterns. We do not use third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
            <p>
              For privacy requests or questions, contact us at: <span className="text-accent">privacy@snaplistapp.app</span>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex gap-4 text-xs text-muted">
          <Link href="/terms" className="hover:text-white">Terms of Service</Link>
          <Link href="/acceptable-use" className="hover:text-white">Acceptable Use</Link>
          <Link href="/" className="hover:text-white">Home</Link>
        </div>
      </main>
    </div>
  );
}
