"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Mail, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const supabase = createClient();

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) { setError("Enter your email address"); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setMagicLinkSent(true);
    }
    setLoading(false);
  };

  const handleEmailPassword = async () => {
    if (!email || !password) { setError("Enter email and password"); return; }
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        // Supabase sends a confirmation email — show the verify screen
        setMagicLinkSent(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Supabase returns "Email not confirmed" when verification is pending
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setMagicLinkSent(true);
        } else {
          setError(error.message);
        }
      } else {
        router.push(next);
        router.refresh();
      }
    }
    setLoading(false);
  };

  // Check for "verify" query param (redirected from middleware when email not confirmed)
  const needsVerification = searchParams.get("verify") === "true";
  const verifyEmail = searchParams.get("email") || email;

  const handleResendVerification = async () => {
    if (!verifyEmail) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: verifyEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setResendCooldown(60);
    }
    setLoading(false);
  };

  if (magicLinkSent || needsVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
        <div className="card-panel max-w-md w-full text-center py-12 px-8">
          <div className="w-16 h-16 rounded-2xl bg-accent2/10 border border-accent2/30 flex items-center justify-center mx-auto mb-5">
            {needsVerification ? (
              <Mail className="w-8 h-8 text-accent2" />
            ) : (
              <CheckCircle className="w-8 h-8 text-accent2" />
            )}
          </div>
          <h2 className="text-xl font-bold mb-2">
            {needsVerification ? "Verify your email" : "Check your email"}
          </h2>
          <p className="text-sm text-muted mb-6">
            {needsVerification
              ? "You need to verify your email address before you can start scanning."
              : `We sent a ${mode === "signup" ? "confirmation" : "login"} link to`}
            {" "}
            <span className="text-white font-medium">{verifyEmail}</span>
          </p>

          {error && (
            <p className="text-sm text-danger border border-danger/40 bg-danger/10 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResendVerification}
              disabled={loading || resendCooldown > 0 || !verifyEmail}
              className="btn-primary mx-auto justify-center px-6 py-2.5 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                "Resend verification email"
              )}
            </button>
            <button
              onClick={() => {
                setMagicLinkSent(false);
                setEmail("");
                // Clear query params
                router.replace("/login");
              }}
              className="text-sm text-accent hover:underline"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <span className="text-2xl font-bold tracking-tight">SnapList</span>
          </Link>
          <h1 className="text-xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {mode === "signin"
              ? "Sign in to access your scans and listings"
              : "Start scanning cards — free trial included"}
          </p>
        </div>

        <div className="card-panel p-6 space-y-5">
          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-panel2 text-sm font-medium hover:bg-panel transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => handleOAuth("apple")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-panel2 text-sm font-medium hover:bg-panel transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Email field */}
          <div>
            <label className="label">Email</label>
            <input
              className="input mt-1"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (password ? handleEmailPassword() : handleMagicLink())}
            />
          </div>

          {/* Password field (toggle) */}
          <div>
            <label className="label">Password</label>
            <input
              className="input mt-1"
              type="password"
              placeholder={mode === "signup" ? "Create a password (min 6 chars)" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailPassword()}
            />
          </div>

          {/* Disclaimer checkbox — signup only */}
          {mode === "signup" && (
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border bg-panel2 accent-accent shrink-0"
              />
              <span className="text-xs text-muted leading-relaxed group-hover:text-gray-300 transition-colors">
                I understand this is an AI-assisted identification tool and I am
                solely responsible for verifying all card details before listing
                or selling. I agree to the{" "}
                <Link href="/terms" className="text-accent hover:underline" target="_blank">
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-accent hover:underline" target="_blank">
                  Privacy Policy
                </Link>.
              </span>
            </label>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleEmailPassword}
              disabled={loading || !email || (mode === "signup" && !agreedToTerms)}
              className="btn-primary w-full justify-center py-3"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={handleMagicLink}
              disabled={loading || !email || (mode === "signup" && !agreedToTerms)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-muted hover:text-white hover:bg-panel2 transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Send magic link instead
            </button>
          </div>

          {error && (
            <p className="text-sm text-danger border border-danger/40 bg-danger/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Toggle sign in / sign up */}
        <p className="text-center text-sm text-muted">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button onClick={() => { setMode("signup"); setError(null); setAgreedToTerms(false); }} className="text-accent hover:underline">
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => { setMode("signin"); setError(null); }} className="text-accent hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>

        {/* Legal links */}
        <div className="flex justify-center gap-4 text-xs text-muted">
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/acceptable-use" className="hover:text-white transition-colors">Acceptable Use</Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
