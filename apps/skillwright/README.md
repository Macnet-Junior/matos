# Skillwright

A desk for writing [Agent Skills](https://agentskills.io/specification). A skill is a folder with a `SKILL.md` file: YAML frontmatter the agent reads at startup, and markdown instructions it follows once the skill matches the task.

Skillwright checks the name, description, and supporting files against that spec, shows the `SKILL.md` it will emit, and downloads the folder.

## Run it

Skillwright lives in the MatOS pnpm workspace as `apps/skillwright`. From the repo root:

```bash
pnpm install
pnpm dev:skillwright
```

That starts Next.js on [http://localhost:43123](http://localhost:43123) so it does not take the Desk app port (`apps/web` on `:3000`).

From this directory, the same commands are:

```bash
pnpm dev
pnpm test
pnpm lint
```

## What you get

- A draft for the skill name, description, and instructions
- Optional license, compatibility, allowed tools, and metadata
- Cursor fields when you want them: `paths`, `disable-model-invocation`, icon, and color
- Extra files under `scripts/`, `references/`, and `assets/`
- A zip whose root is the skill folder, ready to drop into `.cursor/skills/` or `.agents/skills/`

Drafts stay in this browser (`localStorage`). Nothing is uploaded.

## YouTube links

Skillwright is the only code that calls Gemini to turn a YouTube link into a skill. Desk is where the link is pasted (a job’s Sources panel). Desk imports this module; it does not have its own Gemini client.

Set `GEMINI_API_KEY` in `apps/web/.env.local`. That is your key — Google bills it. Optional `GEMINI_MODEL` (default `gemini-3.8-flash`). Gemini is given the YouTube URL directly (`file_data.file_uri`). If the call fails or the reply is not a skill file, the link stays unfinished and can be retried. It does not become a watched skill. A pasted transcript uses the same draft and grade when the video cannot be read.

## Where a finished skill goes

| Scope | Path |
| --- | --- |
| This project, Cursor | `.cursor/skills/<name>/SKILL.md` |
| This project, any agent that reads the standard | `.agents/skills/<name>/SKILL.md` |
| Your machine | `~/.cursor/skills/<name>/SKILL.md` |

The folder name must match `name` in the frontmatter.