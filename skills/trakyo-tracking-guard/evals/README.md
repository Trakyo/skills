# Evals: `trakyo-tracking-guard`

Three realistic tasks, each on a fixture project under `files/`, graded with the assertions
in `evals.json`. Every run is a fresh agent in a fresh context; the with-skill run is told to
read `SKILL.md` and follow it, the baseline gets the same prompt and project with no skill.
Grading is by script (exact tag shape, redirect forwarding, request fields, report content),
evidence line recorded per assertion. Re-run with Anthropic's `skill-creator` skill
(`evals/evals.json` is in its format) whenever `SKILL.md` or a reference changes.

## Iteration 1, 2026-10-19

Model: Claude Sonnet 4.5 for both configurations, one run per eval and configuration.

| Eval | With skill | Baseline | Time (with / base) | Tokens (with / base) |
|---|---|---|---|---|
| `pr-diff-review` | 5/5 | 5/5 | 39 s / 43 s | 122k / 119k |
| `add-agents-section` | 5/5 | 1/5 | 46 s / 67 s | 122k / 120k |
| `consent-banner` | 5/5 | 5/5 | 45 s / 44 s | 121k / 118k |
| **Total** | **15/15** | **11/15** | 43 s / 51 s | 122k / 119k |

Pass rate: with skill 100%, baseline 73%.

### What the runs showed

- **Two evals do not discriminate, and that is a finding about the fixture, not the skill**: in
  `pr-diff-review` and `consent-banner` the fixture project already carries the Trakyo section in
  its `AGENTS.md` (the output of the skill's step 4). With that section in the repo the baseline
  caught all four breakages and left the tag ungated with the right reasoning. That is exactly
  what the section exists to do; it also means the skill's measured value is concentrated in the
  first run on a project.
- **Where the skill earns its keep**: `add-agents-section`. The baseline wrote a sensible but
  incomplete rule set (no hidden `trakyo_id` input, no cross-domain link rule, no
  `identity.trakyo_id` for backend conversions), invented its own checker instead of shipping the
  one that mirrors the API's finding codes, and never pointed at the probe URL or the verify endpoint.
- **To make the first two evals discriminate**, add variants without `AGENTS.md`; keep these as
  the "section already present" regression.

## Multi-model pass, 2026-10-20 (v1.2.0)

The same three tasks, one run per eval and configuration, on Claude Haiku 4.5 and
Claude Opus alongside the Sonnet 4.5 run above: same prompts, same grader (two of
its regexes were widened so a helper module, a multi-line object or a ternary
counts; the Sonnet numbers did not move). Time and tokens are with skill / baseline.

| Model | Eval | With skill | Baseline | Time | Tokens |
|---|---|---|---|---|---|
| Haiku 4.5 | `pr-diff-review` | 4/5 | 2/5 | 128 s / 134 s | 105k / 102k |
| Haiku 4.5 | `add-agents-section` | 4/5 | 1/5 | 92 s / 178 s | 101k / 105k |
| Haiku 4.5 | `consent-banner` | 3/5 | 1/5 | 113 s / 65 s | 98k / 90k |
| **Haiku 4.5** | **total** | **11/15** | **4/15** | | |
| Sonnet 4.5 | total | 15/15 | 11/15 | 43 s / 51 s | 122k / 119k |
| Opus | `pr-diff-review` | 5/5 | 5/5 | 97 s / 83 s | 130k / 124k |
| Opus | `add-agents-section` | 5/5 | 1/5 | 178 s / 129 s | 143k / 125k |
| Opus | `consent-banner` | 5/5 | 5/5 | 113 s / 86 s | 135k / 122k |
| **Opus** | **total** | **15/15** | **11/15** | | |

What the runs showed:

- **`pr-diff-review` and `consent-banner` do not discriminate on Opus**: the
  fixture project's `AGENTS.md` already carries the Trakyo rules, and Opus
  follows them without the skill. That is the skill's own mechanism working
  (step 5 exists so the rules outlive the session), and it is why
  `add-agents-section` is the eval that matters: the baseline wrote its own
  rules, its own check script and its own CI step, and covered one of the five
  assertions.
- **The Opus run found a bug in the check script.** `check-install.mjs --probe`
  built the probe URL from the page it landed on after following redirects, not
  from the URL passed in, so it never travelled the redirect chain it was meant to
  test; a redirect that dropped the query string passed unless the input URL
  already carried one. Fixed in v1.2.0 (`scripts/__tests__/check-install-probe.test.ts`
  in the monorepo pins it with a local redirecting server). The agent worked
  around it by appending `?utm_source=trakyo-check` to the URLs in its `npm run
  check:tracking`, which was the right call.
- **Haiku with the skill audits well and reports poorly**: it fixed three of the
  four PR breakages and wrote a complete `AGENTS.md`, but in two of three runs its
  report never mentioned the probe URL or the check script, and on the consent
  banner it gated nothing and said nothing about the attribution trade-off.

## Trigger set, 2026-10-20

`trigger-set.json` holds 20 queries: 10 that should load this skill and 10 near misses
(adjacent analytics work, the sibling skills' tasks, generic engineering). Each query ran
3 times on Claude Sonnet 4.5 in a fresh, otherwise empty project with the skill
registered as a command; a run counts as triggered when the agent invokes the skill
within its first six turns. Pass = triggered on at least 2 of 3 runs for a positive,
at most 1 of 3 for a negative.

| Description | Positives | Negatives | Total |
|---|---|---|---|
| **Iteration 1 (shipped)** | 10/10 | 8/10 | 18/20 |
| Iteration 2: iteration 1 plus an explicit "Not for …" sentence | 10/10 | 7/10 | 17/20 |

Iteration 2 did not improve the score, so the shorter iteration 1 ships. Misses of the
shipped description, all near-miss negatives:

| Query | Expected | Triggered |
|---|---|---|
| Send our Stripe purchases to Trakyo from the backend | should not | 3/3 |
| Our GA4 events stopped firing after we added the consent banner, fix it | should not | 2/3 |

A sibling skill's task triggering this skill when it is the only Trakyo skill installed is
expected: there is nothing else to route to. With all three skills installed the boundary
sentence does the routing, measured on the sibling queries (3 runs each, first skill invoked):

| Query | Routed here |
|---|---|
| Review this PR that changes our redirects; our site uses Trakyo so make sure tracking still works | 3/3 |
| Make sure the redirects in this PR don't break our Trakyo tracking before we deploy | 3/3 |

Across all 18 routing runs the first skill invoked was the expected one 18 times.

Two notes on method, so the next person does not lose an hour to them: Anthropic's
`skill-creator` runner (`run_eval.py`) returns "not triggered" the moment the agent's
first tool call is anything but the skill, and Sonnet in a bare directory runs `ls`
first; and its workers share one `.claude/commands/` directory, so each agent sees six
copies of the skill and invokes any of them. Isolate each run in its own project root
and count a skill invocation in any early turn.

## Assertions

### 1. `pr-diff-review`

> Review the changes described in PR.md before we deploy, and fix anything that would break our tracking.

- src/lib/seo.ts no longer removes trakyo_id, tclid or utm_* from the URL (cleanUrl deleted, no longer called, or those keys exempted)
- The / to /en redirect in src/router.tsx forwards the query string
- CheckoutButton appends trakyo_id to the checkout.acmepay.com URL, read from window.trakyo_id or the trakyo_id cookie
- NewsletterForm includes trakyo_id in what it posts (hidden input or read from window.trakyo_id / cookie)
- The final report names all four problems and mentions running scripts/check-install.mjs or the ?trakyo_id=probe check before deploy

### 2. `add-agents-section`

> We use Trakyo for attribution (tracking host go.acme-coaching.com, tagged domains www.acme-coaching.com and app.acme-coaching.com). Set this project up so future AI edits don't break tracking, and give us a pre-deploy check.

- An AGENTS.md or CLAUDE.md exists with a Trakyo section that names go.acme-coaching.com and both tagged domains, with no literal HOST / customer.com placeholder left
- The section states: tag unchanged (no defer/async/tag manager), every redirect keeps the query string, no replaceState/canonical stripping, hidden trakyo_id input on forms, cross-domain links carry the id, backend conversions send identity.trakyo_id
- check-install.mjs is copied into the project (scripts/ or .github/)
- The deploy workflow or package.json runs check-install.mjs against https://www.acme-coaching.com/ after deploy with --host go.acme-coaching.com
- The report mentions the probe URL or POST /v1/setup/verify as the manual check

### 3. `consent-banner`

> Add the CookieYes banner (script id abcd1234) and move all our third-party scripts behind it so nothing loads before the visitor accepts.

- The report explicitly tells the user that gating the Trakyo tag behind consent loses attribution for visitors who have not accepted, and recommends keeping it ungated as first-party functional tracking or loading it synchronously on consent before any embed
- If the Trakyo tag is gated, the Calendly embed is gated too and the Trakyo tag is loaded before Calendly on consent; if not gated, it stays a plain blocking tag in <head>
- The Trakyo tag never ends up with defer, async, or a type="text/plain" placeholder that CookieYes rewrites
- Exactly one Trakyo tag remains
- The report mentions verifying with the probe URL or scripts/check-install.mjs

