import fs from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "@/lib/knowledge";

export type FaqDoc = {
  path: string;
  title: string;
  content: string;
  tokens: string[];
};

const SUPPORT_DIR = "knowledge/support";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s#-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export async function loadFaqDocs(): Promise<FaqDoc[]> {
  const abs = path.resolve(repoRoot(), SUPPORT_DIR);
  let files: string[] = [];
  try {
    files = (await fs.readdir(abs)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const docs: FaqDoc[] = [];
  for (const file of files) {
    const rel = `${SUPPORT_DIR}/${file}`;
    const content = await fs.readFile(path.join(abs, file), "utf8");
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? file;
    docs.push({
      path: rel,
      title,
      content,
      tokens: tokenize(`${title}\n${content}`),
    });
  }
  return docs;
}

export type FaqMatch = {
  path: string;
  title: string;
  score: number;
  excerpt: string;
};

export function scoreFaqQuery(query: string, docs: FaqDoc[]): FaqMatch[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const scored: FaqMatch[] = [];
  for (const doc of docs) {
    let score = 0;
    const set = new Set(doc.tokens);
    for (const t of qTokens) {
      if (set.has(t)) score += 1;
      if (doc.title.toLowerCase().includes(t)) score += 2;
    }
    if (score <= 0) continue;
    const excerpt =
      doc.content
        .replace(/^#.+$/m, "")
        .trim()
        .slice(0, 280)
        .replace(/\s+/g, " ") + (doc.content.length > 280 ? "…" : "");
    scored.push({ path: doc.path, title: doc.title, score, excerpt });
  }
  return scored.sort((a, b) => b.score - a.score);
}

/** Keywords that must escalate — never invent refunds / billing outcomes */
const ESCALATE_PATTERNS = [
  /\brefund\b/i,
  /\bchargeback\b/i,
  /\bstripe\s+payout\b/i,
  /\bcancel\s+(my\s+)?subscription\b/i,
  /\bmoney\s+back\b/i,
];

export function shouldEscalateToTicket(query: string): boolean {
  return ESCALATE_PATTERNS.some((re) => re.test(query));
}

export type FaqReply = {
  kind: "answer" | "escalate" | "none";
  text: string;
  matches: FaqMatch[];
  usedLlm: boolean;
};

/**
 * Deterministic FAQ matcher (v1). If OPENAI_API_KEY is set, callers may
 * optionally enrich — this function itself never invents refunds and
 * always uses keyword retrieval for grounding.
 */
export async function matchFaq(query: string): Promise<FaqReply> {
  const docs = await loadFaqDocs();
  const matches = scoreFaqQuery(query, docs).slice(0, 3);

  if (shouldEscalateToTicket(query)) {
    return {
      kind: "escalate",
      text:
        "I can’t process billing refunds or payment reversals in chat. Please open a Support ticket so an Owner can review credits under Ops → Billing. Stripe connect is not live yet (Phase 4b later).",
      matches,
      usedLlm: false,
    };
  }

  if (matches.length === 0) {
    return {
      kind: "none",
      text:
        "I don’t have a matching FAQ for that. Open a Support ticket and an Owner/Operator will follow up.",
      matches: [],
      usedLlm: false,
    };
  }

  const top = matches[0];
  const text = `From **${top.title}** (${top.path}):\n\n${top.excerpt}${
    matches.length > 1
      ? `\n\nAlso see: ${matches
          .slice(1)
          .map((m) => m.title)
          .join(", ")}`
      : ""
  }`;

  return { kind: "answer", text, matches, usedLlm: false };
}
