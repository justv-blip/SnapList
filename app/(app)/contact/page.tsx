"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Send, MessageSquare, Bug, Lightbulb, Gift } from "lucide-react";

const TOPICS = [
  { value: "general", label: "General Question", icon: MessageSquare },
  { value: "bug", label: "Bug Report", icon: Bug },
  { value: "feature", label: "Feature Request", icon: Lightbulb },
  { value: "credits", label: "Credits Submission", icon: Gift },
];

function ContactForm() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState("general");
  const [sent, setSent] = useState(false);

  // Pre-select topic from query param (e.g. /contact?topic=credits)
  useEffect(() => {
    const t = searchParams.get("topic");
    if (t && TOPICS.some((tp) => tp.value === t)) setTopic(t);
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="card-panel flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent2/10 border border-accent2/20 flex items-center justify-center mb-4">
          <Send className="w-7 h-7 text-accent2" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Message sent</h2>
        <p className="text-sm text-muted">
          Thanks for reaching out! We&apos;ll get back to you as soon as possible.
        </p>
        <button className="btn mt-6" onClick={() => setSent(false)}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-panel space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-5 h-5 text-accent" />
        <h2 className="font-semibold">Send a message</h2>
      </div>

      <div>
        <label className="label">Topic</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {TOPICS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`btn flex items-center gap-2 ${
                topic === t.value ? "border-accent/50 text-accent bg-accent/5" : ""
              }`}
              onClick={() => setTopic(t.value)}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
        {topic === "credits" && (
          <p className="text-xs text-muted mt-2">
            Include a link or screenshot as proof of your review or video. Credits are reviewed
            within 24–48 hours and added to your account automatically.
          </p>
        )}
      </div>

      <div>
        <label className="label">Your email</label>
        <input type="email" className="input mt-1" placeholder="you@example.com" required />
      </div>

      <div>
        <label className="label">Subject</label>
        <input
          className="input mt-1"
          placeholder={topic === "credits" ? "Credits submission — [Review / Video]" : "What's this about?"}
          required
        />
      </div>

      <div>
        <label className="label">Message</label>
        <textarea
          className="input mt-1 min-h-[140px]"
          placeholder={
            topic === "credits"
              ? "Paste the link to your review or video, and let us know which platform it's on…"
              : "Tell us more…"
          }
          required
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          <Send className="w-4 h-4" />
          Send Message
        </button>
      </div>
    </form>
  );
}

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contact</h1>
        <p className="text-sm text-muted mt-1">
          Questions, bugs, feature ideas, or credits submissions — we&apos;d love to hear from you
        </p>
      </div>
      <Suspense fallback={null}>
        <ContactForm />
      </Suspense>
    </div>
  );
}
