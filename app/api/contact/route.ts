// POST /api/contact
// Stores a contact form submission in the contact_messages table.
// Optionally sends an email notification via Resend if RESEND_API_KEY is set.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString } from "@/lib/validation";

const VALID_TOPICS = ["general", "bug", "feature", "credits"] as const;
type ContactTopic = (typeof VALID_TOPICS)[number];

function isValidTopic(t: unknown): t is ContactTopic {
  return VALID_TOPICS.includes(t as ContactTopic);
}

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = body.topic;
  const email = sanitizeString(body.email as string, 254);
  const subject = sanitizeString(body.subject as string, 300);
  const message = sanitizeString(body.message as string, 5000);

  if (!isValidTopic(topic)) {
    return NextResponse.json({ error: "Invalid topic" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!subject || subject.length < 3) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ error: "Message is required (min 10 characters)" }, { status: 400 });
  }

  // Store in Supabase using service role so RLS doesn't block the insert.
  const { error: dbError } = await auth.supabase.from("contact_messages").insert({
    user_id: auth.user.id,
    topic,
    email,
    subject,
    message,
  });

  if (dbError) {
    console.error("[contact] db insert failed", dbError.message);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }

  // Optional: send an email notification via Resend.
  // To enable, set RESEND_API_KEY and CONTACT_NOTIFY_EMAIL in your env.
  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.CONTACT_NOTIFY_EMAIL;
  if (resendKey && notifyEmail) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "SnapList <noreply@snaplist.gg>",
          to: [notifyEmail],
          reply_to: email,
          subject: `[SnapList Contact] ${topic.toUpperCase()}: ${subject}`,
          text: `From: ${email}\nTopic: ${topic}\nUser ID: ${auth.user.id}\n\n${message}`,
        }),
      });
    } catch (emailErr) {
      // Non-fatal — message is already saved to the DB.
      console.error("[contact] email notification failed", emailErr);
    }
  }

  return NextResponse.json({ success: true });
}
