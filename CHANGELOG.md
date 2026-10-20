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
