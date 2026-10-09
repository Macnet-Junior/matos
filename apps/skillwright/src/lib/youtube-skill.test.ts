import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GEMINI_MODEL,
  MISSING_GEMINI_KEY_MESSAGE,
  draftSkillFromInput,
  parsePastedTranscript,
  parseYouTubeUrl,
  type DraftSkillResult,
} from "./youtube-skill";

const KEY = "test-gemini-key-not-real";

const GOOD_SKILL = {
  name: "faceless-workflow",
  description:
    "Turn the faceless YouTube workflow from this video into steps an agent can follow. Use when the user asks to apply that workflow.",
  body: `# Faceless workflow

## What is on screen

A screen recording of the editor, with the timeline open and the first fifteen seconds highlighted.

## Steps

1. Cut the opening to the claim.
2. Show the workflow on the timeline before explaining it.
3. End on the same claim the opening made.
`,
  language: "en",
  durationMs: 120_000,
  segments: [
    { startMs: 0, endMs: 3_000, text: "Hey guys, welcome back to the channel." },
    { startMs: 4_000, endMs: 9_000, text: "Don't forget to subscribe." },
    { startMs: 40_000, endMs: 46_000, text: "In this video I explain the workflow step by step." },
    { startMs: 70_000, endMs: 74_000, text: "Here's why the workflow matters." },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function geminiEnvelope(skill: unknown): unknown {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(skill) }],
        },
      },
    ],
  };
}

function assertUnfinished(result: DraftSkillResult) {
  assert.equal(result.ok, false);
  assert.equal(result.watched, false);
  assert.equal(result.readiness, "unfinished");
  assert.equal(result.retryable, true);
  assert.equal("skillMarkdown" in result, false);
}

test("a YouTube URL becomes a draft skill and is never watched", async () => {
  let called: { url: string; header: string | null; body: string } | null = null;
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://youtu.be/dQw4w9WgXcQ?t=3" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async (url, init) => {
        called = {
          url: String(url),
          header: new Headers(init?.headers).get("x-goog-api-key"),
          body: String(init?.body ?? ""),
        };
        return jsonResponse(geminiEnvelope(GOOD_SKILL));
      },
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.watched, false);
  assert.equal(result.readiness, "draft");
  assert.equal(result.retryable, false);
  assert.equal(result.provider, "gemini");
  assert.equal(result.skillName, "faceless-workflow");
  assert.match(result.skillMarkdown, /^---\nname: faceless-workflow\n/);
  assert.match(result.skillMarkdown, /What is on screen/);
  assert.match(result.skillMarkdown, /not a watched skill/i);
  assert.doesNotMatch(result.skillMarkdown, /allowed-tools/);
  assert.equal(result.skillMarkdown.includes(KEY), false);
  assert.equal(result.segments.length, 4);
  assert.equal(result.segments[0]?.text, "Hey guys, welcome back to the channel.");

  assert.ok(called);
  const request = called as { url: string; header: string | null; body: string };
  assert.match(request.url, new RegExp(`/models/${DEFAULT_GEMINI_MODEL}:generateContent$`));
  assert.equal(request.url.includes(KEY), false);
  assert.equal(request.url.includes("key="), false);
  assert.equal(request.header, KEY);
  const payload = JSON.parse(request.body) as {
    contents: Array<{ parts: Array<{ file_data?: { file_uri: string; mime_type: string } }> }>;
  };
  assert.equal(
    payload.contents[0]?.parts[0]?.file_data?.file_uri,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.equal(payload.contents[0]?.parts[0]?.file_data?.mime_type, "video/*");
  assert.equal(request.body.includes(KEY), false);
});

test("a failed Gemini call stays unfinished and retryable", async () => {
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async () => jsonResponse({ error: { message: `leak ${KEY}` } }, 502),
    },
  );
  assertUnfinished(result);
  if (result.ok) return;
  assert.equal(result.code, "call_failed");
  assert.match(result.reason, /problem on its side/i);
  assert.equal(result.reason.includes(KEY), false);
});

test("a network failure stays unfinished", async () => {
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async () => {
        throw new Error(`connect ${KEY}`);
      },
    },
  );
  assertUnfinished(result);
  if (result.ok) return;
  assert.equal(result.code, "call_failed");
  assert.match(result.reason, /Could not reach Gemini/);
  assert.equal(result.reason.includes(KEY), false);
});

test("a reply that is not a skill stays unfinished and is not a draft", async () => {
  const cases = [
    geminiEnvelope({ nope: true }),
    geminiEnvelope({
      name: "ok-name",
      description: "Too short to be a skill description for an agent.",
      body: "no",
    }),
    { candidates: [{ content: { parts: [{ text: "not json at all" }] } }] },
    { candidates: [] },
  ];
  for (const body of cases) {
    const result = await draftSkillFromInput(
      { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      {
        env: { GEMINI_API_KEY: KEY },
        fetchImpl: async () => jsonResponse(body),
      },
    );
    assertUnfinished(result);
    if (result.ok) continue;
    assert.equal(result.code, "bad_parse");
    assert.match(result.reason, /not a skill/i);
  }
});

test("a missing key does not call Gemini", async () => {
  let called = false;
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    {
      env: {},
      fetchImpl: async () => {
        called = true;
        return jsonResponse(geminiEnvelope(GOOD_SKILL));
      },
    },
  );
  assert.equal(called, false);
  assertUnfinished(result);
  if (result.ok) return;
  assert.equal(result.code, "missing_key");
  assert.equal(result.reason, MISSING_GEMINI_KEY_MESSAGE);
  assert.match(result.reason, /GEMINI_API_KEY/);
  assert.match(result.reason, /\.env\.local/);
});

test("a pasted transcript uses the same draft path and keeps the pasted words", async () => {
  const transcript = [
    "[00:00] Hey guys, welcome back to the channel.",
    "[00:04] Don't forget to subscribe.",
    "[00:40] In this video I explain the workflow step by step.",
    "[01:10] Here's why the workflow matters.",
  ].join("\n");
  let sawFile = false;
  let sawTranscript = false;
  const result = await draftSkillFromInput(
    { mode: "transcript", text: transcript, title: "Episode notes" },
    {
      env: { GEMINI_API_KEY: KEY, GEMINI_MODEL: "gemini-3.8-flash" },
      fetchImpl: async (_url, init) => {
        const body = String(init?.body ?? "");
        sawFile = body.includes("file_data");
        sawTranscript = body.includes("Hey guys, welcome back");
        return jsonResponse(
          geminiEnvelope({
            ...GOOD_SKILL,
            segments: [{ startMs: 0, endMs: 1, text: "invented line the model made up" }],
          }),
        );
      },
    },
  );

  assert.equal(sawFile, false);
  assert.equal(sawTranscript, true);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.watched, false);
  assert.equal(result.readiness, "draft");
  assert.equal(result.provider, "manual");
  assert.equal(result.segments[0]?.text, "Hey guys, welcome back to the channel.");
  assert.equal(result.segments.some((segment) => segment.text.includes("invented")), false);
  assert.match(result.skillMarkdown, /name: faceless-workflow/);
});

test("a pasted transcript with no timestamps is still one segment", () => {
  const segments = parsePastedTranscript("The price went up because support costs doubled.");
  assert.equal(segments.length, 1);
  assert.equal(segments[0]?.startMs, 0);
  assert.match(segments[0]?.text ?? "", /support costs/);
});

test("a non-YouTube link is rejected before any call", async () => {
  let called = false;
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://example.com/watch?v=dQw4w9WgXcQ" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async () => {
        called = true;
        return jsonResponse(geminiEnvelope(GOOD_SKILL));
      },
    },
  );
  assert.equal(called, false);
  assertUnfinished(result);
  if (result.ok) return;
  assert.equal(result.code, "bad_input");
});

test("segment times may be clock strings", async () => {
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async () =>
        jsonResponse(
          geminiEnvelope({
            ...GOOD_SKILL,
            segments: [
              { startMs: "00:00", endMs: "00:12", text: "Stop. Here is the one change that saves twenty minutes." },
              { startMs: "00:40", endMs: "01:10", text: "In this video I explain the workflow step by step." },
            ],
          }),
        ),
    },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.watched, false);
  assert.equal(result.segments[0]?.startMs, 0);
  assert.equal(result.segments[0]?.endMs, 12_000);
  assert.equal(result.segments[1]?.startMs, 40_000);
});

test("parseYouTubeUrl accepts watch, shorts, and youtu.be", () => {
  assert.equal(
    parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ").ok,
    true,
  );
  const parsed = parseYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});
