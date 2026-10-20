# Changelog

All three skills move together: one version number, one tag on
[github.com/Trakyo/skills](https://github.com/Trakyo/skills) (`v<version>`), one
release carrying a tarball and a SHA-256 digest per skill. `metadata.version` in
every `SKILL.md` equals the newest version here, and CI refuses a merge where they
differ. A change to any `skills/<name>/` file needs a new version; the publish
workflow refuses to sync content under an existing tag.

The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow [SemVer](https://semver.org/): a change that makes an agent do something
different on the same prompt is minor, a wording or reference fix is patch, a
removed skill or renamed script flag is major.

## [1.2.0] - 2026-10-20

### Added
- The Agent Skills discovery index: `index.json` on every release, served at
  `https://trakyo.io/.well-known/agent-skills/index.json`, so
  `npx skills add https://trakyo.io` installs from the domain and verifies each
  tarball's SHA-256 digest.
- A Claude Code plugin: `.claude-plugin/plugin.json` and `marketplace.json`, so
  `claude plugin marketplace add Trakyo/skills` then `claude plugin install
  trakyo@trakyo` installs all three skills.
- A `Gotchas` section in every skill: the environment facts that defy reasonable
  assumptions (a probe URL records no visit, `unknown` is not "broken", an
  email-only conversion is stored with a `201` and credited to nobody, and so on),
  collected in one place instead of scattered through the steps.
- A table of contents in `trakyo-conversions/references/server-side.md`.
- Adoption telemetry you can see: `check-install.mjs` identifies itself as
  `trakyo-skill/check-install@<version>` and sends `X-Trakyo-Skill` on its API
  call; the documented `curl` and fetch examples send
  `X-Trakyo-Skill: <skill>@<version>`. The header carries no identity (the bearer
  token does) and only counts skill-driven requests in Trakyo's API log.
- Eval results for Claude Haiku 4.5 and Claude Opus alongside Sonnet 4.5 in each
  skill's `evals/README.md`.
- The install guide is also a resource of the Trakyo MCP server
  (`trakyo://install-guide`, the body of `trakyo-install/SKILL.md`) and a page on
  the docs site (`trakyo.io/docs/install`, with `/docs/install/agents` for the
  agent install paths).

### Fixed
- `check-install.mjs --probe` built the probe URL from the page it landed on
  after following redirects, not from the URL you passed, so it never travelled
  the redirect chain it exists to test: a redirect that dropped the query string
  passed unless the input URL already carried one. Found by the Opus eval run.

### Fixed
- Release tarballs unpack to the skill's files with `SKILL.md` at the root, which is
  what the discovery clients require; v1.1.0's were nested one directory down and
  the `npx skills` CLI rejected them. They are now reproducible byte for byte
  (`gzip -n`) and in ustar format.

## [1.1.0] - 2026-10-19

### Added
- `evals/` in every skill: three realistic tasks each, with fixture projects and
  graded assertions, plus the with-skill versus baseline benchmark in
  `evals/README.md`.
- `scripts/check-install.mjs` now ships in `trakyo-install` as well as
  `trakyo-tracking-guard` (identical copies), with `--help`, `--json`,
  `--timeout`, `--version` and a documented exit-code table.
- `compatibility` on the two skills that run the script (Node 18+, network to the
  site under test and `api.trakyo.io`).
- A "Security and network behaviour" section in the README.

### Changed
- Every description now says what the skill does, when to reach for it, and which
  sibling skill to use instead, measured against a 20-query trigger set per skill.
- The probe in `--probe` mode uses a random id per run instead of a fixed one.
- `trakyo-install` verifies with the script first and the raw `curl` second.

## [1.0.0] - 2026-10-19

### Added
- `trakyo-install`, `trakyo-conversions`, `trakyo-tracking-guard`.
