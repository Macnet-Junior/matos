"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Download,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { zipStore } from "@/lib/zip";
import {
  CURSOR_COLORS,
  CURSOR_ICONS,
  type SkillDraft,
  type SkillFile,
  approxTokens,
  createId,
  folderFor,
  installPaths,
  lineCount,
  serializeSkill,
  templates,
  validateSkill,
} from "@/lib/skill";

const STORAGE_KEY = "skillwright.v1";

type Panel = "write" | "file" | "checks";

const SNIPPETS: { label: string; markdown: string }[] = [
  {
    label: "Steps",
    markdown: `## Steps

1. 
2. 
3. 
`,
  },
  {
    label: "Gotchas",
    markdown: `## Gotchas

- 
`,
  },
  {
    label: "Checklist",
    markdown: `## Checklist

- [ ] 
- [ ] 
`,
  },
  {
    label: "Output template",
    markdown: `## Output

Use this shape:

\`\`\`markdown
# Title

## Finding
What is wrong, where, and the smallest fix.
\`\`\`
`,
  },
];

function loadStore(): { drafts: SkillDraft[]; activeId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { drafts: SkillDraft[]; activeId: string };
    if (!Array.isArray(parsed.drafts) || parsed.drafts.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function initialDesk(): { drafts: SkillDraft[]; activeId: string } {
  const stored = loadStore();
  if (stored) {
    return {
      drafts: stored.drafts,
      activeId: stored.drafts.some((draft) => draft.id === stored.activeId)
        ? stored.activeId
        : stored.drafts[0].id,
    };
  }
  const seed = templates[1].create();
  return { drafts: [seed], activeId: seed.id };
}

export function SkillStudio() {
  const [desk, setDesk] = useState(initialDesk);
  const { drafts, activeId } = desk;
  const [panel, setPanel] = useState<Panel>("write");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ drafts, activeId }));
  }, [drafts, activeId]);

  const draft = drafts.find((item) => item.id === activeId) ?? drafts[0];

  const issues = useMemo(() => (draft ? validateSkill(draft) : []), [draft]);
  const skillMd = useMemo(() => (draft ? serializeSkill(draft) : ""), [draft]);
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warn");

  function setDrafts(updater: (current: SkillDraft[]) => SkillDraft[]) {
    setDesk((current) => ({ ...current, drafts: updater(current.drafts) }));
  }

  function setActiveId(id: string) {
    setDesk((current) => ({ ...current, activeId: id }));
  }

  function update(patch: Partial<SkillDraft>) {
    if (!draft) return;
    setDrafts((current) =>
      current.map((item) =>
        item.id === draft.id ? { ...item, ...patch, updatedAt: Date.now() } : item,
      ),
    );
  }

  function addFromTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const next = template.create();
    setDesk((current) => ({
      drafts: [next, ...current.drafts],
      activeId: next.id,
    }));
    setActiveFileId(next.files[0]?.id ?? null);
    setPanel("write");
  }

  function removeDraft(id: string) {
    setDesk((current) => {
      const remaining = current.drafts.filter((item) => item.id !== id);
      if (remaining.length === 0) {
        const blank = templates[0].create();
        return { drafts: [blank], activeId: blank.id };
      }
      const nextActive =
        current.activeId === id ? remaining[0].id : current.activeId;
      return { drafts: remaining, activeId: nextActive };
    });
  }

  async function copySkill() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(skillMd);
      copied = true;
    } catch {
      const area = document.createElement("textarea");
      area.value = skillMd;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "0";
      area.style.left = "0";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      area.remove();
    }
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  function downloadFolder() {
    if (!draft) return;
    const encoder = new TextEncoder();
    const folder = folderFor(draft);
    const packed = zipStore([
      { path: `${folder}/SKILL.md`, data: encoder.encode(skillMd) },
      ...draft.files
        .filter((file) => file.path.trim())
        .map((file) => ({
          path: `${folder}/${file.path.trim()}`,
          data: encoder.encode(file.content),
        })),
    ]);
    const blob = new Blob([packed.buffer as ArrayBuffer], {
      type: "application/zip",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${folder}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function updateFile(id: string, patch: Partial<SkillFile>) {
    if (!draft) return;
    update({
      files: draft.files.map((file) => (file.id === id ? { ...file, ...patch } : file)),
    });
  }

  if (!draft) {
    return (
      <main className="grid min-h-full place-items-center text-sm text-muted-foreground">
        Opening your drafts…
      </main>
    );
  }

  const activeFile =
    draft.files.find((file) => file.id === activeFileId) ?? draft.files[0] ?? null;
  const bodyLines = lineCount(draft.body);
  const bodyTokens = approxTokens(draft.body);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="mr-auto min-w-0">
            <p className="font-[family-name:var(--font-heading)] text-2xl leading-none tracking-tight">
              Skillwright
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Write a skill an agent can discover and follow.
            </p>
          </div>
          <label className="sr-only" htmlFor="draft-select">
            Open a draft
          </label>
          <select
            id="draft-select"
            className="h-8 max-w-48 rounded-lg border bg-card px-2 text-sm"
            value={draft.id}
            onChange={(event) => {
              setActiveId(event.target.value);
              const next = drafts.find((item) => item.id === event.target.value);
              setActiveFileId(next?.files[0]?.id ?? null);
            }}
          >
            {drafts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || "untitled-skill"}
              </option>
            ))}
          </select>
          <select
            aria-label="Start from a template"
            className="h-8 max-w-44 rounded-lg border bg-card px-2 text-sm"
            value=""
            onChange={(event) => {
              if (event.target.value) addFromTemplate(event.target.value);
            }}
          >
            <option value="">New from…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => void copySkill()}>
            {copyState === "copied" ? <Check /> : <Copy />}
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy SKILL.md"}
          </Button>
          <Button type="button" onClick={downloadFolder} disabled={errors.length > 0}>
            <Download />
            Download folder
          </Button>
        </div>
      </header>

      <div className="flex gap-1 border-b px-4 py-2 lg:hidden">
        {(
          [
            ["write", "Write"],
            ["file", "SKILL.md"],
            ["checks", "Checks"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={panel === id ? "default" : "ghost"}
            onClick={() => setPanel(id)}
          >
            {label}
            {id === "checks" && errors.length > 0 ? ` (${errors.length})` : ""}
          </Button>
        ))}
      </div>

      <div className="grid flex-1 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(18rem,24rem)]">
        <section
          className={`border-b lg:border-r lg:border-b-0 ${panel === "write" ? "block" : "hidden lg:block"}`}
        >
          <div className="space-y-5 p-4 sm:p-5">
            <Field label="Name" hint="Folder name. Lowercase, numbers, hyphens.">
              <Input
                value={draft.name}
                spellCheck={false}
                placeholder="review-a-change"
                onChange={(event) => update({ name: event.target.value })}
              />
            </Field>
            <Field
              label="Description"
              hint={`${draft.description.length}/1024. The agent reads this before it opens the skill.`}
            >
              <Textarea
                value={draft.description}
                rows={5}
                placeholder="What it does. Use when…"
                onChange={(event) => update({ description: event.target.value })}
              />
            </Field>

            <details className="rounded-lg border bg-card px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Optional fields</summary>
              <div className="mt-3 space-y-3">
                <Field label="License">
                  <Input
                    value={draft.license}
                    placeholder="Apache-2.0"
                    onChange={(event) => update({ license: event.target.value })}
                  />
                </Field>
                <Field label="Compatibility" hint="Only if the skill needs specific tools.">
                  <Textarea
                    rows={2}
                    value={draft.compatibility}
                    onChange={(event) => update({ compatibility: event.target.value })}
                  />
                </Field>
                <Field label="Allowed tools" hint="Experimental. Space-separated.">
                  <Input
                    value={draft.allowedTools}
                    placeholder="Bash Read"
                    onChange={(event) => update({ allowedTools: event.target.value })}
                  />
                </Field>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Metadata</Label>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        update({
                          metadata: [
                            ...draft.metadata,
                            { id: createId(), key: "", value: "" },
                          ],
                        })
                      }
                    >
                      <Plus />
                      Add
                    </Button>
                  </div>
                  {draft.metadata.map((entry) => (
                    <div key={entry.id} className="flex gap-2">
                      <Input
                        aria-label="Metadata key"
                        placeholder="author"
                        value={entry.key}
                        onChange={(event) =>
                          update({
                            metadata: draft.metadata.map((item) =>
                              item.id === entry.id
                                ? { ...item, key: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <Input
                        aria-label="Metadata value"
                        placeholder="your-team"
                        value={entry.value}
                        onChange={(event) =>
                          update({
                            metadata: draft.metadata.map((item) =>
                              item.id === entry.id
                                ? { ...item, value: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Remove metadata"
                        onClick={() =>
                          update({
                            metadata: draft.metadata.filter((item) => item.id !== entry.id),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
              <div>
                <p className="text-sm font-medium">Cursor fields</p>
                <p className="text-xs text-muted-foreground">
                  File globs, slash-command only, badge icon and color.
                </p>
              </div>
              <Switch
                checked={draft.cursorFields}
                onCheckedChange={(checked) => update({ cursorFields: checked })}
              />
            </div>

            {draft.cursorFields ? (
              <div className="space-y-3 rounded-lg border bg-card p-3">
                <Field label="Paths" hint="One glob per line. Leave empty to apply everywhere.">
                  <Textarea
                    rows={3}
                    value={draft.paths.join("\n")}
                    placeholder={"**/*.tsx"}
                    onChange={(event) =>
                      update({
                        paths: event.target.value.split("\n"),
                      })
                    }
                  />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Only when typed</p>
                    <p className="text-xs text-muted-foreground">
                      Sets disable-model-invocation. The agent will not open it on its own.
                    </p>
                  </div>
                  <Switch
                    checked={draft.disableModelInvocation}
                    onCheckedChange={(checked) =>
                      update({ disableModelInvocation: checked })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Icon">
                    <select
                      className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                      value={draft.icon}
                      onChange={(event) => update({ icon: event.target.value })}
                    >
                      {CURSOR_ICONS.map((icon) => (
                        <option key={icon || "none"} value={icon}>
                          {icon || "Default lightning"}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Color">
                    <select
                      className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                      value={draft.color}
                      onChange={(event) => update({ color: event.target.value })}
                    >
                      <option value="">Default</option>
                      {CURSOR_COLORS.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Supporting files</Label>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    const file: SkillFile = {
                      id: createId(),
                      path: "references/notes.md",
                      content: "",
                    };
                    update({ files: [...draft.files, file] });
                    setActiveFileId(file.id);
                  }}
                >
                  <Plus />
                  Add file
                </Button>
              </div>
              {draft.files.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Put long reference, a script, or a template beside SKILL.md. Mention the path in the instructions.
                </p>
              ) : (
                <ul className="space-y-1">
                  {draft.files.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className={`w-full rounded-md px-2 py-1 text-left font-mono text-xs ${
                          activeFile?.id === file.id ? "bg-accent" : "hover:bg-muted"
                        }`}
                        onClick={() => setActiveFileId(file.id)}
                      >
                        {file.path || "untitled"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {activeFile ? (
                <div className="space-y-2 rounded-lg border bg-card p-3">
                  <Input
                    aria-label="File path"
                    value={activeFile.path}
                    spellCheck={false}
                    onChange={(event) =>
                      updateFile(activeFile.id, { path: event.target.value })
                    }
                  />
                  <Textarea
                    aria-label="File contents"
                    rows={8}
                    className="font-mono text-xs"
                    value={activeFile.content}
                    onChange={(event) =>
                      updateFile(activeFile.id, { content: event.target.value })
                    }
                  />
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      update({
                        files: draft.files.filter((file) => file.id !== activeFile.id),
                      });
                      setActiveFileId(null);
                    }}
                  >
                    <Trash2 />
                    Remove file
                  </Button>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeDraft(draft.id)}
            >
              <Trash2 />
              Delete this draft
            </Button>
          </div>
        </section>

        <section
          className={`min-w-0 border-b lg:border-r lg:border-b-0 ${panel === "write" ? "block" : "hidden lg:block"}`}
        >
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
            <p className="mr-auto text-sm font-medium">Instructions</p>
            <span className="text-xs text-muted-foreground">
              {bodyLines} lines · ~{bodyTokens} tokens
            </span>
            {SNIPPETS.map((snippet) => (
              <Button
                key={snippet.label}
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  update({
                    body: `${draft.body.replace(/\s*$/, "")}\n\n${snippet.markdown}`,
                  })
                }
              >
                {snippet.label}
              </Button>
            ))}
          </div>
          <Textarea
            aria-label="Skill instructions"
            value={draft.body}
            onChange={(event) => update({ body: event.target.value })}
            className="min-h-[70vh] resize-y rounded-none border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 shadow-none focus-visible:ring-0 sm:px-6"
          />
        </section>

        <aside className={`${panel === "write" ? "hidden lg:block" : "block"}`}>
          <div className={panel === "file" ? "block" : "hidden lg:block"}>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <p className="text-sm font-medium">SKILL.md</p>
              <Badge variant={errors.length ? "destructive" : "secondary"}>
                {errors.length ? `${errors.length} to fix` : "Valid frontmatter"}
              </Badge>
            </div>
            <pre className="max-h-[50vh] overflow-auto px-4 py-3 font-mono text-[12px] leading-5 whitespace-pre-wrap lg:max-h-[46vh]">
              {skillMd}
            </pre>
          </div>

          <div className={`border-t ${panel === "checks" || panel === "file" ? "block" : "hidden lg:block"}`}>
            <div className="space-y-3 p-4">
              <p className="text-sm font-medium">What the agent sees</p>
              <ol className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <span className="text-foreground">1. At startup.</span> Name and description only,
                  about {approxTokens(`${draft.name} ${draft.description}`)} tokens.
                </li>
                <li>
                  <span className="text-foreground">2. When it opens the skill.</span> This whole
                  SKILL.md, about {approxTokens(skillMd)} tokens.
                </li>
                <li>
                  <span className="text-foreground">3. On demand.</span>{" "}
                  {draft.files.length
                    ? draft.files.map((file) => file.path).join(", ")
                    : "No extra files yet."}
                </li>
              </ol>

              <div>
                <p className="mb-1 text-sm font-medium">Where to save it</p>
                <ul className="space-y-1 font-mono text-[11px] leading-5">
                  {installPaths(draft).map((item) => (
                    <li key={item.path}>
                      <span className="font-sans text-muted-foreground">{item.label}</span>
                      <br />
                      {item.path}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Checks</p>
                {issues.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Name, description, and files match the Agent Skills spec.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {issues.map((issue, index) => (
                      <li
                        key={`${issue.field}-${index}`}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          issue.level === "error"
                            ? "border-destructive/40 bg-destructive/10"
                            : "bg-accent"
                        }`}
                      >
                        <span className="font-medium">
                          {issue.level === "error" ? "Fix" : "Consider"} · {issue.field}
                        </span>
                        <p className="mt-0.5">{issue.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {warnings.length > 0 && errors.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    You can still download. Warnings are about how well the agent will use it.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}