// Supabase Edge Function: ai-chat
// Proxies chat messages to the Anthropic API using a server-side secret key.
// The browser never sees the Anthropic API key.
//
// Deploy:
//   supabase functions deploy ai-chat
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
//
// Called from the frontend as:
//   POST {SUPABASE_URL}/functions/v1/ai-chat
//   headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY or user access_token}` }
//   body: { system: string, messages: [{role, content}, ...] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1000;

// Basic in-memory rate limiting per Supabase user id / IP (resets on cold start —
// fine as a first line of defense; move to a DB table for real limits at scale).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain in production
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: missing ANTHROPIC_API_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Identify the caller for rate limiting: prefer the Supabase auth user id
  // (present in the JWT `sub` claim), fall back to the connection IP.
  const authHeader = req.headers.get("Authorization") || "";
  const rateKey =
    authHeader.replace("Bearer ", "").slice(0, 40) ||
    req.headers.get("x-forwarded-for") ||
    "anonymous";

  if (isRateLimited(rateKey)) {
    return new Response(
      JSON.stringify({ error: "Too many requests, please slow down." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let payload: { system?: string; messages?: { role: string; content: string }[] };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cap history sent upstream to control cost / latency.
  const trimmedMessages = messages.slice(-20).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? "").slice(0, 4000),
  }));

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system: String(payload.system ?? "").slice(0, 4000),
        messages: trimmedMessages,
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return new Response(
        JSON.stringify({ error: data?.error?.message || "Upstream error" }),
        { status: anthropicRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reply = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to reach AI service" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});