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

## Where a finished skill goes

| Scope | Path |
| --- | --- |
| This project, Cursor | `.cursor/skills/<name>/SKILL.md` |
| This project, any agent that reads the standard | `.agents/skills/<name>/SKILL.md` |
| Your machine | `~/.cursor/skills/<name>/SKILL.md` |

The folder name must match `name` in the frontmatter.