import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GEMINI_MODEL,
  MISSING_GEMINI_KEY_MESSAGE,
  VIDEO_BLOCKED_MESSAGE,
  VIDEO_TOO_LONG_MESSAGE,
  YOUTUBE_TIMEOUT_MESSAGE,
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

async function withErrorLog(run: (logs: string[]) => Promise<void>): Promise<void> {
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map((part) => String(part)).join(" "));
  };
  try {
    await run(logs);
  } finally {
    console.error = original;
  }
}

function assertPlainVideoRequest(body: string, videoUrl: string) {
  const payload = JSON.parse(body) as {
    contents: Array<{ parts: Array<{ fileData?: { fileUri?: string }; text?: string }> }>;
    generationConfig?: unknown;
  };
  assert.equal(payload.contents[0]?.parts[0]?.fileData?.fileUri, videoUrl);
  assert.equal(payload.generationConfig, undefined);
  const folded = body.toLowerCase();
  assert.equal(folded.includes("file_data"), false);
  assert.equal(folded.includes("mediaresolution"), false);
  assert.equal(folded.includes("media_resolution"), false);
  assert.equal(folded.includes("videometadata"), false);
  assert.equal(folded.includes("video_metadata"), false);
  assert.equal(folded.includes("\"fps\""), false);
  assert.equal(body.includes(KEY), false);
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
    contents: Array<{ parts: Array<{ fileData?: { fileUri?: string } }> }>;
    generationConfig?: { temperature?: number; responseMimeType?: string };
  };
  assert.equal(
    payload.contents[0]?.parts[0]?.fileData?.fileUri,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.equal(payload.generationConfig?.responseMimeType, "application/json");
  assert.equal(payload.generationConfig?.temperature, 0.2);
  const folded = request.body.toLowerCase();
  assert.equal(folded.includes("file_data"), false);
  assert.equal(folded.includes("mediaresolution"), false);
  assert.equal(folded.includes("media_resolution"), false);
  assert.equal(folded.includes("videometadata"), false);
  assert.equal(folded.includes("video_metadata"), false);
  assert.equal(folded.includes("\"fps\""), false);
  assert.equal(request.body.includes(KEY), false);
});

test("a YouTube read that runs past the limit stays unfinished", async () => {
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    {
      env: { GEMINI_API_KEY: KEY },
      timeoutMs: 20,
      fetchImpl: async (_url, init) => {
        assert.ok(init?.signal);
        const err = new Error("The operation was aborted");
        err.name = "TimeoutError";
        throw err;
      },
    },
  );
  assertUnfinished(result);
  if (result.ok) return;
  assert.equal(result.code, "call_failed");
  assert.equal(result.reason, YOUTUBE_TIMEOUT_MESSAGE);
  assert.match(result.reason, /paste a transcript/i);
  assert.equal(result.reason.includes(KEY), false);
});

test("a video Gemini calls too long stays unfinished and does not leak the key", async () => {
  let calls = 0;
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(
          { error: { message: `The video exceeds the maximum allowed duration (${KEY}).` } },
          400,
        );
      },
    },
  );
  assert.equal(calls, 1);
  assertUnfinished(result);
  if (result.ok) return;
  assert.equal(result.code, "call_failed");
  assert.equal(result.reason, VIDEO_TOO_LONG_MESSAGE);
  assert.equal(result.reason.includes(KEY), false);
});

test("a failed Gemini call stays unfinished and retryable", async () => {
  let calls = 0;
  await withErrorLog(async (logs) => {
    const result = await draftSkillFromInput(
      { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      {
        env: { GEMINI_API_KEY: KEY },
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse({ error: { message: `leak ${KEY}` } }, 502);
        },
      },
    );
    assert.equal(calls, 2);
    assertUnfinished(result);
    if (result.ok) return;
    assert.equal(result.code, "call_failed");
    assert.match(result.reason, /problem on its side/i);
    assert.match(result.reason, /HTTP 502/);
    assert.equal(result.reason.includes(KEY), false);
    const logged = logs.join("\n");
    assert.match(logged, /Gemini HTTP 502 \(json\)/);
    assert.match(logged, /Gemini HTTP 502 \(plain\)/);
    assert.match(logged, /leak \[redacted\]/);
    assert.equal(logged.includes(KEY), false);
  });
});

test("a Gemini 500 on the tuned request falls back to the plain body that worked", async () => {
  const bodies: string[] = [];
  await withErrorLog(async (logs) => {
    const result = await draftSkillFromInput(
      { mode: "youtube", url: "https://www.youtube.com/watch?v=eWKY0OnPByg" },
      {
        env: { GEMINI_API_KEY: KEY },
        fetchImpl: async (_url, init) => {
          const body = String(init?.body ?? "");
          bodies.push(body);
          if (bodies.length === 1) {
            return jsonResponse(
              { error: { message: `Internal error encountered. key=${KEY}` } },
              500,
            );
          }
          return jsonResponse(geminiEnvelope(GOOD_SKILL));
        },
      },
    );
    assert.equal(bodies.length, 2);
    const first = JSON.parse(bodies[0] ?? "{}") as {
      generationConfig?: { responseMimeType?: string };
    };
    assert.equal(first.generationConfig?.responseMimeType, "application/json");
    assertPlainVideoRequest(
      bodies[1] ?? "",
      "https://www.youtube.com/watch?v=eWKY0OnPByg",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.watched, false);
    assert.equal(result.skillName, "faceless-workflow");
    const logged = logs.join("\n");
    assert.match(logged, /Gemini HTTP 500 \(json\)/);
    assert.match(logged, /Internal error encountered/);
    assert.match(logged, /retrying the plain YouTube request/);
    assert.equal(logged.includes(KEY), false);
  });
});

test("a 400 that rejects a tuning option retries the plain request", async () => {
  const bodies: string[] = [];
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=eWKY0OnPByg" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async (_url, init) => {
        bodies.push(String(init?.body ?? ""));
        if (bodies.length === 1) {
          return jsonResponse(
            { error: { message: 'Unknown name "responseMimeType": Cannot find field.' } },
            400,
          );
        }
        return jsonResponse(geminiEnvelope(GOOD_SKILL));
      },
    },
  );
  assert.equal(bodies.length, 2);
  assertPlainVideoRequest(bodies[1] ?? "", "https://www.youtube.com/watch?v=eWKY0OnPByg");
  assert.equal(result.ok, true);
});

test("a request Gemini still rejects names HTTP 400 and Google's sentence", async () => {
  let calls = 0;
  await withErrorLog(async (logs) => {
    const result = await draftSkillFromInput(
      { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      {
        env: { GEMINI_API_KEY: KEY },
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(
            { error: { message: `Invalid argument in the request (${KEY}).` } },
            400,
          );
        },
      },
    );
    assert.equal(calls, 2);
    assertUnfinished(result);
    if (result.ok) return;
    assert.match(result.reason, /rejected the request we sent/);
    assert.match(result.reason, /HTTP 400/);
    assert.match(result.reason, /Invalid argument/);
    assert.doesNotMatch(result.reason, /problem on its side/i);
    assert.equal(result.reason.includes(KEY), false);
    assert.match(logs.join("\n"), /Gemini HTTP 400/);
    assert.equal(logs.join("\n").includes(KEY), false);
  });
});

test("an HTTP 503 that says unavailable is a Google-side error", async () => {
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async () =>
        jsonResponse({ error: { message: "Service unavailable." } }, 503),
    },
  );
  assertUnfinished(result);
  if (result.ok) return;
  assert.match(result.reason, /problem on its side/i);
  assert.match(result.reason, /HTTP 503/);
  assert.match(result.reason, /Service unavailable/);
  assert.doesNotMatch(result.reason, /public YouTube/);
});

test("a private video is not retried and is not called a Google outage", async () => {
  let calls = 0;
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ error: { message: "The video is private." } }, 400);
      },
    },
  );
  assert.equal(calls, 1);
  assertUnfinished(result);
  if (result.ok) return;
  assert.match(result.reason, /public YouTube link/);
  assert.doesNotMatch(result.reason, /problem on its side/i);
  assert.doesNotMatch(result.reason, /rejected the request we sent/);
});

test("a blocked video says it was blocked", async () => {
  const cases = [
    { promptFeedback: { blockReason: "SAFETY" }, candidates: [] },
    {
      candidates: [
        { finishReason: "PROHIBITED_CONTENT", content: { parts: [{ text: "" }] } },
      ],
    },
  ];
  for (const body of cases) {
    let calls = 0;
    await withErrorLog(async (logs) => {
      const result = await draftSkillFromInput(
        { mode: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
        {
          env: { GEMINI_API_KEY: KEY },
          fetchImpl: async () => {
            calls += 1;
            return jsonResponse(body);
          },
        },
      );
      assert.equal(calls, 1);
      assertUnfinished(result);
      if (result.ok) return;
      assert.equal(result.code, "call_failed");
      assert.equal(result.reason, VIDEO_BLOCKED_MESSAGE);
      assert.doesNotMatch(result.reason, /problem on its side/i);
      assert.doesNotMatch(result.reason, /not a skill/i);
      assert.match(logs.join("\n"), /Gemini HTTP 200 \(json\): blocked/);
      assert.equal(logs.join("\n").includes(KEY), false);
    });
  }
});

test("a JSON-mode reply that is not JSON retries the plain request", async () => {
  let calls = 0;
  const result = await draftSkillFromInput(
    { mode: "youtube", url: "https://www.youtube.com/watch?v=eWKY0OnPByg" },
    {
      env: { GEMINI_API_KEY: KEY },
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({
            candidates: [{ content: { parts: [{ text: "Here is a one-sentence summary." }] } }],
          });
        }
        return jsonResponse(geminiEnvelope(GOOD_SKILL));
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.ok, true);
});

test("a network failure stays unfinished", async () => {
  await withErrorLog(async (logs) => {
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
    assert.match(logs.join("\n"), /Gemini request failed \(json\): Error/);
    assert.equal(logs.join("\n").includes(KEY), false);
  });
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

test("parseYouTubeUrl accepts watch, shorts, youtu.be, and a share-sheet paste", () => {
  assert.equal(
    parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ").ok,
    true,
  );
  const parsed = parseYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

  const share = parseYouTubeUrl(
    "A normal video\nhttps://www.youtube.com/watch?v=eWKY0OnPByg",
  );
  assert.equal(share.ok, true);
  if (share.ok) {
    assert.equal(share.videoId, "eWKY0OnPByg");
    assert.equal(share.url, "https://www.youtube.com/watch?v=eWKY0OnPByg");
  }

  const bare = parseYouTubeUrl("youtu.be/eWKY0OnPByg");
  assert.equal(bare.ok, true);
  if (bare.ok) assert.equal(bare.url, "https://www.youtube.com/watch?v=eWKY0OnPByg");

  const playlist = parseYouTubeUrl("https://www.youtube.com/playlist?list=PLabcdefghij");
  assert.equal(playlist.ok, false);
  if (!playlist.ok) assert.match(playlist.reason, /video id/i);

  const words = parseYouTubeUrl("not a link at all");
  assert.equal(words.ok, false);
  if (!words.ok) assert.match(words.reason, /not a YouTube link/i);
});
