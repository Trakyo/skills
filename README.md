# Trakyo agent skills

Skills that teach a coding agent (Claude Code, Cursor, Codex, Lovable, v0, any agent
that reads [Agent Skills](https://agentskills.io)) how to install Trakyo tracking,
keep it working, and send conversions that are actually attributed.

| Skill | Use it when |
|---|---|
| [`trakyo-install`](trakyo-install/SKILL.md) | Installing the tag on a site, or auditing an install that "isn't working". The exact tag shape, parameter forwarding, embeds, per-platform notes, verification with `POST /v1/setup/verify`. |
| [`trakyo-conversions`](trakyo-conversions/SKILL.md) | Sending purchases / signups / bookings from a backend or thank-you page. The `identity.trakyo_id` rule, the attribution block, batch, reversals. |
| [`trakyo-tracking-guard`](trakyo-tracking-guard/SKILL.md) | Any change to a site that is already tracked. The six silent breakages, the pre-deploy check script, the `AGENTS.md` section to drop into the project. |

## Install

```bash
npx skills add Trakyo/skills                      # pick interactively
npx skills add Trakyo/skills --skill trakyo-install -a claude-code
```

Manual (any agent that reads `SKILL.md` files):

```bash
cp -r skills/trakyo-install ~/.claude/skills/     # Claude Code, global
cp -r skills/trakyo-install .claude/skills/       # this project only
```

Only the pre-deploy check needs a runtime: Node 18+, no dependencies
(`trakyo-tracking-guard/scripts/check-install.mjs`).

## Layout

```
skills/
  trakyo-install/
    SKILL.md
    references/checks.md        # the eight finding codes, same as the API
    references/platforms.md     # where the tag goes per builder, and each one's trap
    references/embeds.md        # vendor auto-tagging, hidden-field names, cross-domain hops
  trakyo-conversions/
    SKILL.md
    references/server-side.md   # POST /v1/conversions, batch, reversals, capture pattern
    references/thank-you-page.md
  trakyo-tracking-guard/
    SKILL.md
    assets/AGENTS-trakyo-section.md   # drop-in rules for a tracked project
    scripts/check-install.mjs         # static checks + redirect probe + /v1/setup/verify
```

Each `SKILL.md` follows the [Agent Skills specification](https://agentskills.io/specification):
`name` equals the directory, `description` carries the trigger phrases, the body
stays short and the detail lives in `references/`. Validate with
`skills-ref validate skills/<name>`.

## Source of truth

This directory in the `trakyo` monorepo is canonical; the public repo
`github.com/Trakyo/skills` is a copy of it, rewritten by
`.github/workflows/publish-skills.yml` on every merge to `main` that touches
`skills/` (never edit the public repo by hand). `src/__tests__/skills-spec.test.ts`
pins the spec constraints in CI. The rules here must not drift from
`src/lib/tracking/install-snippet.ts` (the tag shape and its reasoning),
`workers/api/src/lib/setup-checks.ts` (the finding codes) and
`workers/docs/pages/conversions.mdx` (the identity rules). When one of those
changes, change the skill in the same PR.
