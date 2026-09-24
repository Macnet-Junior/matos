export type SkillFile = {
  id: string;
  path: string;
  content: string;
};

export type MetadataEntry = {
  id: string;
  key: string;
  value: string;
};

export type SkillDraft = {
  id: string;
  name: string;
  description: string;
  license: string;
  compatibility: string;
  allowedTools: string;
  metadata: MetadataEntry[];
  cursorFields: boolean;
  paths: string[];
  disableModelInvocation: boolean;
  icon: string;
  color: string;
  body: string;
  files: SkillFile[];
  updatedAt: number;
};

export type IssueLevel = "error" | "warn";

export type Issue = {
  level: IssueLevel;
  field: string;
  message: string;
};

export const CURSOR_COLORS = [
  "default",
  "green",
  "cyan",
  "blue",
  "purple",
  "magenta",
  "orange",
  "yellow",
  "red",
  "brand",
] as const;

export const CURSOR_ICONS = [
  "",
  "code",
  "terminal",
  "bug",
  "git-branch",
  "book-open",
  "beaker",
  "shield",
  "rocket",
] as const;

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE_PATH_RE =
  /^(scripts|references|assets)\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function validateName(name: string): string | null {
  if (!name) return "Name is required.";
  if (name.length > 64) return "Name must be 64 characters or fewer.";
  if (name.startsWith("-") || name.endsWith("-")) {
    return "Name cannot start or end with a hyphen.";
  }
  if (name.includes("--")) return "Name cannot contain consecutive hyphens.";
  if (!NAME_RE.test(name)) {
    return "Use lowercase letters, numbers, and single hyphens.";
  }
  return null;
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

function yamlQuote(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n")}"`;
}

function yamlScalar(value: string): string {
  if (value === "") return '""';
  if (
    /[:#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value) ||
    /^(true|false|null|yes|no|on|off)$/i.test(value) ||
    /^[-?]/.test(value) ||
    /^\d/.test(value)
  ) {
    return yamlQuote(value);
  }
  return value;
}

export function serializeSkill(draft: SkillDraft): string {
  const lines: string[] = ["---", `name: ${draft.name || "untitled-skill"}`];
  lines.push(`description: ${yamlQuote(draft.description)}`);

  if (draft.license.trim()) {
    lines.push(`license: ${yamlScalar(draft.license.trim())}`);
  }
  if (draft.compatibility.trim()) {
    lines.push(`compatibility: ${yamlQuote(draft.compatibility.trim())}`);
  }
  if (draft.allowedTools.trim()) {
    lines.push(`allowed-tools: ${yamlQuote(draft.allowedTools.trim())}`);
  }

  const metadata = draft.metadata.filter((entry) => entry.key.trim());
  if (metadata.length > 0) {
    lines.push("metadata:");
    for (const entry of metadata) {
      lines.push(
        `  ${yamlScalar(entry.key.trim())}: ${yamlQuote(entry.value)}`,
      );
    }
  }

  if (draft.cursorFields) {
    const paths = draft.paths.map((path) => path.trim()).filter(Boolean);
    if (paths.length > 0) {
      lines.push("paths:");
      for (const path of paths) lines.push(`  - ${yamlQuote(path)}`);
    }
    if (draft.disableModelInvocation) {
      lines.push("disable-model-invocation: true");
    }
    if (draft.icon.trim()) lines.push(`icon: ${yamlScalar(draft.icon.trim())}`);
    if (draft.color.trim()) {
      lines.push(`color: ${yamlScalar(draft.color.trim())}`);
    }
  }

  lines.push("---", "");
  const body = draft.body.replace(/\s+$/, "");
  return `${lines.join("\n")}\n${body}\n`;
}

export function lineCount(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

export function approxTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}

const PATH_MENTION =
  /(?:^|[\s("'`)])((?:scripts|references|assets)\/[A-Za-z0-9][A-Za-z0-9._-]*)/g;

export function mentionedPaths(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(PATH_MENTION)) {
    found.add(match[1]);
  }
  return [...found];
}

export function folderFor(draft: SkillDraft): string {
  return draft.name || "untitled-skill";
}

export function installPaths(draft: SkillDraft): { label: string; path: string }[] {
  const folder = folderFor(draft);
  return [
    { label: "This project", path: `.cursor/skills/${folder}/SKILL.md` },
    { label: "Any agent in this project", path: `.agents/skills/${folder}/SKILL.md` },
    { label: "Your machine", path: `~/.cursor/skills/${folder}/SKILL.md` },
  ];
}

export function validateSkill(draft: SkillDraft): Issue[] {
  const issues: Issue[] = [];
  const nameError = validateName(draft.name);
  if (nameError) issues.push({ level: "error", field: "name", message: nameError });

  const description = draft.description.trim();
  if (!description) {
    issues.push({
      level: "error",
      field: "description",
      message: "Description is required. Say what the skill does and when to use it.",
    });
  } else if (description.length > 1024) {
    issues.push({
      level: "error",
      field: "description",
      message: `Description is ${description.length} characters. The limit is 1024.`,
    });
  } else {
    if (description.length < 40) {
      issues.push({
        level: "warn",
        field: "description",
        message: "Description is thin. Name the task and the trigger, not just the topic.",
      });
    }
    if (!/\b(use when|when the|when a|when an|if the|if a)\b/i.test(description)) {
      issues.push({
        level: "warn",
        field: "description",
        message:
          'Tell the agent when to open the skill. A phrase like "Use when…" is what gets matched.',
      });
    }
  }

  if (draft.compatibility.trim().length > 500) {
    issues.push({
      level: "error",
      field: "compatibility",
      message: "Compatibility must be 500 characters or fewer.",
    });
  }

  const keys = new Set<string>();
  for (const entry of draft.metadata) {
    const key = entry.key.trim();
    if (!key && !entry.value.trim()) continue;
    if (!key) {
      issues.push({
        level: "error",
        field: "metadata",
        message: "Every metadata value needs a key.",
      });
      continue;
    }
    if (keys.has(key)) {
      issues.push({
        level: "error",
        field: "metadata",
        message: `Metadata key "${key}" is repeated.`,
      });
    }
    keys.add(key);
  }

  const bodyLines = lineCount(draft.body);
  const tokens = approxTokens(draft.body);
  if (bodyLines > 500) {
    issues.push({
      level: "warn",
      field: "body",
      message: `Instructions are ${bodyLines} lines. Keep SKILL.md under 500 and move detail into references/.`,
    });
  }
  if (tokens > 5000) {
    issues.push({
      level: "warn",
      field: "body",
      message: `Instructions are about ${tokens} tokens. Aim for under 5,000 so the skill stays in focus.`,
    });
  }
  if (draft.body.trim().length < 80) {
    issues.push({
      level: "warn",
      field: "body",
      message: "Instructions are still a sketch. Add the steps the agent should actually take.",
    });
  }

  const seenPaths = new Set<string>();
  for (const file of draft.files) {
    const path = file.path.trim();
    if (!FILE_PATH_RE.test(path)) {
      issues.push({
        level: "error",
        field: "files",
        message: `"${path || "(empty)"}" must live in scripts/, references/, or assets/ and use a single filename.`,
      });
      continue;
    }
    if (seenPaths.has(path)) {
      issues.push({
        level: "error",
        field: "files",
        message: `"${path}" is listed twice.`,
      });
    }
    seenPaths.add(path);
  }

  const mentions = mentionedPaths(`${draft.body}\n${draft.files.map((file) => file.content).join("\n")}`);
  for (const mention of mentions) {
    if (!draft.files.some((file) => file.path.trim() === mention)) {
      issues.push({
        level: "warn",
        field: "files",
        message: `Instructions mention ${mention}, but that file is not in the folder.`,
      });
    }
  }
  for (const file of draft.files) {
    const path = file.path.trim();
    if (!FILE_PATH_RE.test(path)) continue;
    if (!mentions.includes(path) && !draft.body.includes(path)) {
      issues.push({
        level: "warn",
        field: "files",
        message: `${path} is never mentioned. Tell the agent when to open it.`,
      });
    }
  }

  if (draft.cursorFields && draft.color && !CURSOR_COLORS.includes(draft.color as (typeof CURSOR_COLORS)[number])) {
    issues.push({
      level: "error",
      field: "color",
      message: "Color must be one of the Cursor badge colors.",
    });
  }

  return issues;
}

export function emptyDraft(partial: Partial<SkillDraft> = {}): SkillDraft {
  return {
    id: createId(),
    name: "",
    description: "",
    license: "",
    compatibility: "",
    allowedTools: "",
    metadata: [],
    cursorFields: false,
    paths: [],
    disableModelInvocation: false,
    icon: "",
    color: "",
    body: "# Skill title\n\n## When to use\n\n- \n\n## Steps\n\n1. \n",
    files: [],
    updatedAt: Date.now(),
    ...partial,
  };
}

function file(path: string, content: string): SkillFile {
  return { id: createId(), path, content };
}

export type Template = {
  id: string;
  label: string;
  blurb: string;
  create: () => SkillDraft;
};

export const templates: Template[] = [
  {
    id: "blank",
    label: "Blank skill",
    blurb: "Name, description, and an empty procedure.",
    create: () => emptyDraft(),
  },
  {
    id: "review",
    label: "Review a change",
    blurb: "A repeatable review the agent runs on a diff.",
    create: () =>
      emptyDraft({
        name: "review-a-change",
        description:
          "Review a code change for regressions, missing tests, and behavior the author may have overlooked. Use when the user asks for a review, a second pass, or feedback on a diff.",
        body: `# Review a change

Read the diff before commenting. Stay with the change in front of you.

## Steps

1. Read the changed files and the tests that cover them.
2. State what the change is trying to do, in one sentence.
3. Look for behavior that breaks, including empty, error, and boundary cases.
4. Check that tests fail for the old behavior and pass for the new one.
5. Note anything you are unsure about instead of inventing a defect.

## Write the review

Lead with the outcome: approve, approve with nits, or request changes.

Then list findings. For each one:

- File and the behavior that is wrong
- Why it matters
- The smallest change that would fix it

Skip style comments the formatter already owns. Skip praise that does not help the next edit.
`,
      }),
  },
  {
    id: "release",
    label: "Ship a release",
    blurb: "A checklist with a script the agent must run.",
    create: () =>
      emptyDraft({
        name: "ship-a-release",
        description:
          "Cut a release by running the repo checks, tagging, and confirming the deployed health check. Use when the user asks to ship, release, tag, or deploy this project.",
        compatibility: "Requires git and the project's package manager.",
        body: `# Ship a release

Follow this sequence. Do not skip the check script.

## Checklist

- [ ] Working tree is clean on the release branch
- [ ] \`bash scripts/check-release.sh\` exits 0
- [ ] Version in the changelog matches the tag you will create
- [ ] Health check URL returns 200 after deploy

## Steps

1. Read \`references/release-notes.md\` and draft the changelog entry from commits since the last tag.
2. Run \`bash scripts/check-release.sh\`. If it fails, stop and report the output.
3. Ask the user to confirm the version before tagging.
4. After they confirm, create an annotated tag and push it.
5. Watch the health check. Report the URL and status code.

Do not invent a version. If the changelog and the user disagree, stop and ask.
`,
        files: [
          file(
            "scripts/check-release.sh",
            `#!/usr/bin/env bash
set -euo pipefail

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is dirty. Commit or stash before releasing." >&2
  exit 1
fi

echo "Release check passed."
`,
          ),
          file(
            "references/release-notes.md",
            `# Release notes shape

One section per version:

## 1.2.0

- What changed for someone using the product
- What they need to do, if anything
`,
          ),
        ],
      }),
  },
  {
    id: "slash",
    label: "Explicit command",
    blurb: "Only runs when someone types /skill-name.",
    create: () =>
      emptyDraft({
        name: "write-the-changelog",
        description:
          "Draft a changelog entry from commits since the last tag. Use when the user types /write-the-changelog.",
        cursorFields: true,
        disableModelInvocation: true,
        icon: "book-open",
        color: "orange",
        body: `# Write the changelog

This skill is invoked on purpose. Do not apply it to unrelated writing.

## Steps

1. Find the previous tag with \`git describe --tags --abbrev=0\`.
2. Read commits since that tag. Ignore merge commits.
3. Group user-facing changes under Added, Changed, and Fixed.
4. Leave out refactors that do not change behavior.
5. Show the draft and wait for edits before writing a file.
`,
      }),
  },
];