"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  Send,
  MessageSquare,
  Bug,
  Lightbulb,
  Gift,
  AlertCircle,
  MessageCircle,
  Clock,
  Users,
  ArrowRight,
  Zap,
} from "lucide-react";

const TOPICS = [
  { value: "general",  label: "General Question",    icon: MessageSquare },
  { value: "bug",      label: "Bug Report",           icon: Bug },
  { value: "feature",  label: "Feature Request",      icon: Lightbulb },
  { value: "credits",  label: "Credits Submission",   icon: Gift },
];

function ContactForm() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState("general");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef    = useRef<HTMLInputElement>(null);
  const subjectRef  = useRef<HTMLInputElement>(null);
  const messageRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = searchParams.get("topic");
    if (t && TOPICS.some((tp) => tp.value === t)) setTopic(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          email:   emailRef.current?.value.trim(),
          subject: subjectRef.current?.value.trim(),
          message: messageRef.current?.value.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message");
      }
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="card-panel flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent2/10 border border-accent2/20 flex items-center justify-center mb-4">
          <Send className="w-7 h-7 text-accent2" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Message sent</h2>
        <p className="text-sm text-muted">
          Thanks for reaching out! We&apos;ll get back to you within 24–48 hours.
        </p>
        <button className="btn mt-6" onClick={() => { setSent(false); setError(null); }}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-panel space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-accent" />
        <h2 className="font-semibold text-sm">Send a message</h2>
        <span className="ml-auto text-[10px] text-muted bg-panel2 border border-border px-2 py-0.5 rounded-full flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> 24–48 hr response
        </span>
      </div>

      {/* Topic pills */}
      <div>
        <label className="label">Topic</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {TOPICS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`btn text-xs flex items-center gap-1.5 ${
                topic === t.value ? "border-accent/50 text-accent bg-accent/5" : ""
              }`}
              onClick={() => setTopic(t.value)}
            >
              <t.icon className="w-3.5 h-3.5" />
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
        <input ref={emailRef} type="email" className="input mt-1" placeholder="you@example.com" required />
      </div>
      <div>
        <label className="label">Subject</label>
        <input
          ref={subjectRef}
          className="input mt-1"
          placeholder={topic === "credits" ? "Credits submission — [Review / Video]" : "What's this about?"}
          required
        />
      </div>
      <div>
        <label className="label">Message</label>
        <textarea
          ref={messageRef}
          className="input mt-1 min-h-[120px]"
          placeholder={
            topic === "credits"
              ? "Paste the link to your review or video, and let us know which platform it's on…"
              : "Tell us more…"
          }
          required
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          <Send className="w-4 h-4" />
          {submitting ? "Sending…" : "Send Message"}
        </button>
      </div>
    </form>
  );
}

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contact</h1>
        <p className="text-sm text-muted mt-1">
          Questions, bugs, feature ideas, or credits submissions — we&apos;d love to hear from you.
        </p>
      </div>

      {/* ── Discord card — primary channel ── */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.06] p-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -z-0" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <MessageCircle className="w-7 h-7 text-indigo-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-base">Join our Discord</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-semibold">
                <Zap className="w-2.5 h-2.5" />
                Fastest response
              </span>
            </div>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Chat directly with the team and other sellers. Get real-time help, report bugs, suggest features, and stay ahead of new releases.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted flex-wrap">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Active seller community</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Real-time responses</span>
              <span className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Early access to features</span>
            </div>
          </div>
          <a
            href="/socials"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
          >
            Open Discord
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted">or send us a message</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ── Contact form — secondary channel ── */}
      <Suspense fallback={null}>
        <ContactForm />
      </Suspense>
    </div>
  );
}
