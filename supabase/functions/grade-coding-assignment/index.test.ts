import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/grade-coding-assignment`;

async function call(body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text(); // always consume
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

Deno.test("CORS preflight is allowed", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("rejects requests with no Authorization header", async () => {
  const { status, json } = await call({ submissionId: crypto.randomUUID() });
  assertEquals(status, 401);
  assertEquals(json.error, "Unauthorized");
});

Deno.test("rejects an invalid JWT", async () => {
  const { status, json } = await call(
    { submissionId: crypto.randomUUID() },
    { Authorization: "Bearer not-a-real-jwt" },
  );
  assertEquals(status, 401);
  assertEquals(json.error, "Unauthorized");
});

Deno.test("never leaks AI grading output to unauthenticated callers", async () => {
  const { json } = await call({ submissionId: crypto.randomUUID() });
  assert(!("suggestedScore" in json), "suggestedScore must not be returned without auth");
  assert(!("feedback" in json), "feedback must not be returned without auth");
});

Deno.test("anon service key alone does not grant staff access", async () => {
  const { status } = await call(
    { submissionId: crypto.randomUUID() },
    { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  );
  assert(status === 401 || status === 403, `expected 401/403, got ${status}`);
});

Deno.test("missing submissionId is rejected before any AI call", async () => {
  const { status } = await call({}, { Authorization: "Bearer not-a-real-jwt" });
  // Auth runs first, so this is 401; with a staff token it would be 400.
  assert(status === 401 || status === 400, `expected 401/400, got ${status}`);
});
