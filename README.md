# Trakyo agent skills

Skills that teach a coding agent (Claude Code, Cursor, Codex, Lovable, v0, any agent
that reads [Agent Skills](https://agentskills.io)) how to install Trakyo tracking,
keep it working, and send conversions that are actually attributed.

| Skill | Use it when |
|---|---|
| [`trakyo-install`](trakyo-install/SKILL.md) | Installing the tag on a site, or auditing an install that "isn't working". The exact tag shape, parameter forwarding, embeds, per-platform notes, verification with `scripts/check-install.mjs` and `POST /v1/setup/verify`. |
| [`trakyo-conversions`](trakyo-conversions/SKILL.md) | Sending purchases / signups / bookings from a backend or thank-you page. The `identity.trakyo_id` rule, the attribution block, batch, reversals. |
| [`trakyo-tracking-guard`](trakyo-tracking-guard/SKILL.md) | Any change to a site that is already tracked. The six silent breakages, the pre-deploy check script, the `AGENTS.md` section to drop into the project. |

Each description ends with which sibling to use instead, so an agent holding all
three picks the right one.

## Install

```bash
npx skills add Trakyo/skills                      # from the GitHub repo, pick interactively
npx skills add Trakyo/skills --skill trakyo-install -a claude-code
npx skills add https://trakyo.io                  # from the domain, digest-verified against the release
claude plugin marketplace add Trakyo/skills       # Claude Code plugin: all three skills
claude plugin install trakyo@trakyo
```

The domain install reads [`trakyo.io/.well-known/agent-skills/index.json`](https://trakyo.io/.well-known/agent-skills/index.json)
(the [Agent Skills discovery index](https://github.com/cloudflare/agent-skills-discovery-rfc)),
which names each skill's release tarball and its SHA-256 digest; the CLI refuses a
tarball whose bytes do not match.

Manual (any agent that reads `SKILL.md` files):

```bash
cp -r skills/trakyo-install ~/.claude/skills/     # Claude Code, global
cp -r skills/trakyo-install .claude/skills/       # this project only
```

Only the pre-deploy check needs a runtime: Node 18+, no dependencies
(`scripts/check-install.mjs`, shipped identically in `trakyo-install` and
`trakyo-tracking-guard`; `node scripts/check-install.mjs --help` is its interface).

## Security and network behaviour

Read this before installing from any source, including this one.

- **No skill fetches instructions at runtime.** Everything an agent reads is in
  this repository; nothing is loaded from a URL while the skill runs.
- **One script, and here is exactly what it does.** `scripts/check-install.mjs`
  performs HTTP GETs against the URLs you pass on its command line (and the
  redirect targets they lead to), and, only when an API key is given, a
  `POST https://api.trakyo.io/v1/setup/verify` per URL. It writes no files,
  spawns no processes, and reads no environment variable except `TRAKYO_API_KEY`.
  The key is sent as a bearer token to `api.trakyo.io` and nowhere else; it is
  never printed. It identifies itself: `User-Agent: trakyo-skill/check-install@<version>`
  on every request and `X-Trakyo-Skill: check-install@<version>` on the API call,
  so a site owner can recognise the traffic and Trakyo can count skill-driven
  requests per release. The header carries nothing about you.
- **The `curl` examples** in the skills send only the JSON shown to
  `api.trakyo.io`, plus `X-Trakyo-Skill: <skill>@<version>`, the same adoption
  count as above. An API key with the scope named next to each example
  (`links:read` for verify, `conversions:write` for conversions) is enough; do
  not use a wider one.
- **What the skills change in your project** is limited to what the task names:
  the tag in your HTML or layout, redirects and URL handling, forms and checkout
  links, conversion calls in your backend, and an `AGENTS.md` section. They never
  touch credentials, CI secrets or deployment configuration.
- **Audit it yourself**: the script is under 400 lines of dependency-free JavaScript.
  `skills.sh` shows third-party audit results per skill once they run.

Report a security concern to security@trakyo.io
(see [trakyo.io/.well-known/security.txt](https://app.trakyo.io/.well-known/security.txt)).

## Layout

```
skills/
  CHANGELOG.md                      # one version for all three skills; tags on the public repo
  .claude-plugin/                   # Claude Code plugin + marketplace manifests (same version)
  trakyo-install/
    SKILL.md
    references/checks.md            # the eight finding codes, same as the API
    references/platforms.md         # where the tag goes per builder, and each one's trap
    references/embeds.md            # vendor auto-tagging, hidden-field names, cross-domain hops
    scripts/check-install.mjs       # static checks + redirect probe + /v1/setup/verify
    evals/                          # evals.json, fixture projects, benchmark README
  trakyo-conversions/
    SKILL.md
    references/server-side.md       # POST /v1/conversions, batch, reversals, capture pattern
    references/thank-you-page.md
    evals/
  trakyo-tracking-guard/
    SKILL.md
    assets/AGENTS-trakyo-section.md # drop-in rules for a tracked project
    scripts/check-install.mjs       # identical to trakyo-install's copy
    evals/
```

Each `SKILL.md` follows the [Agent Skills specification](https://agentskills.io/specification):
`name` equals the directory, `description` carries what it does, when to use it and
which sibling to use instead, the body stays short and the detail lives in
`references/`. Validate with `skills-ref validate skills/<name>`.

## Evals

Every skill carries `evals/evals.json`: three realistic tasks, each with a fixture
project under `evals/files/` and assertions a grader can check in the output
(exact tag shape, a redirect that keeps its query string, `identity.trakyo_id` on
the conversion call). `evals/README.md` records the latest with-skill versus
baseline run on Claude Haiku 4.5, Sonnet 4.5 and Opus. Re-run them with
Anthropic's `skill-creator` skill when you change a skill; a change that does not
move the benchmark probably does not need to ship. The runs earn their keep in
both directions: the v1.2.0 Opus pass found that `check-install.mjs --probe`
never travelled the redirect chain it was meant to test.

## Versioning

`skills/CHANGELOG.md` holds one version for all three skills. Every merge to `main`
that changes a skill bumps it; the publish workflow tags the public repo
`v<version>` and attaches one tarball plus a SHA-256 digest per skill to a GitHub
release, together with `index.json`, the discovery index that trakyo.io serves.
`metadata.version` in each `SKILL.md`, the `VERSION` constant in the script, the
plugin manifests and every documented `X-Trakyo-Skill` header equal that number,
and CI fails when they drift.

## Source of truth

This directory in the `trakyo` monorepo is canonical; the public repo
`github.com/Trakyo/skills` is a copy of it, rewritten by
`.github/workflows/publish-skills.yml` on every merge to `main` that touches
`skills/` (never edit the public repo by hand). `src/__tests__/skills-spec.test.ts`
pins the spec constraints in CI. The rules here must not drift from
`src/lib/tracking/install-snippet.ts` (the tag shape and its reasoning),
`workers/api/src/lib/setup-checks.ts` (the finding codes) and
`workers/docs/pages/conversions.mdx` (the identity rules). When one of those
changes, change the skill in the same PR. Two things are generated FROM the
skills and checked in CI: the MCP server's `trakyo://install-guide` resource
(`scripts/skills/sync-install-guide.mjs`, from `trakyo-install/SKILL.md`) and the
release's `index.json` (`scripts/skills/build-well-known-index.mjs`).
