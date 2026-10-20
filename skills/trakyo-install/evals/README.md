# Evals: `trakyo-install`

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
| `lovable-vite-site` | 6/6 | 2/6 | 67 s / 35 s | 127k / 116k |
| `nextjs-app-router` | 5/5 | 4/5 | 32 s / 39 s | 122k / 116k |
| `audit-static-html` | 5/5 | 5/5 | 36 s / 27 s | 121k / 115k |
| **Total** | **16/16** | **11/16** | 45 s / 34 s | 124k / 116k |

Pass rate: with skill 100%, baseline 69%.

### What the runs showed

- **Where the skill earns its keep**: the exact tag URL (`/api/js/latest.js`; the baseline guessed
  `/trakyo.js`), the hidden `trakyo_id` input on the lead form, and knowing that
  `scripts/check-install.mjs` / `POST /v1/setup/verify` exist. Both baselines that touched a
  redirect fixed it on their own: a capable model already knows a redirect should keep its query string.
- **Non-discriminating eval**: `audit-static-html`. The baseline found every problem and named
  `POST /v1/setup/verify` unprompted; the audit task is easy for a strong model and tells us little.
  Keep it as a regression check, do not read its pass as evidence for the skill.
- **Cost**: the with-skill run reads SKILL.md plus one or two references and the script, about
  8k more tokens and 12 s longer per task.

## Trigger set, 2026-10-20

`trigger-set.json` holds 20 queries: 10 that should load this skill and 10 near misses
(adjacent analytics work, the sibling skills' tasks, generic engineering). Each query ran
3 times on Claude Sonnet 4.5 in a fresh, otherwise empty project with the skill
registered as a command; a run counts as triggered when the agent invokes the skill
within its first six turns. Pass = triggered on at least 2 of 3 runs for a positive,
at most 1 of 3 for a negative.

| Description | Positives | Negatives | Total |
|---|---|---|---|
| **Iteration 1 (shipped)** | 10/10 | 7/10 | 17/20 |
| Iteration 2: iteration 1 plus an explicit "Not for …" sentence | 10/10 | 7/10 | 17/20 |

Iteration 2 did not improve the score, so the shorter iteration 1 ships. Misses of the
shipped description, all near-miss negatives:

| Query | Expected | Triggered |
|---|---|---|
| Install the Meta pixel on our landing page and fire a Lead event on form submit | should not | 2/3 |
| Send our paid orders from the Stripe webhook to Trakyo so they get attributed | should not | 3/3 |
| Add a cookie consent banner with CookieYes and gate GA behind it | should not | 3/3 |

A sibling skill's task triggering this skill when it is the only Trakyo skill installed is
expected: there is nothing else to route to. With all three skills installed the boundary
sentence does the routing, measured on the sibling queries (3 runs each, first skill invoked):

| Query | Routed here |
|---|---|
| Install the Trakyo tag on our Webflow site, host go.acme.com | 3/3 |
| Our Trakyo tag is loading with defer, fix the install | 3/3 |

Across all 18 routing runs the first skill invoked was the expected one 18 times.

Two notes on method, so the next person does not lose an hour to them: Anthropic's
`skill-creator` runner (`run_eval.py`) returns "not triggered" the moment the agent's
first tool call is anything but the skill, and Sonnet in a bare directory runs `ls`
first; and its workers share one `.claude/commands/` directory, so each agent sees six
copies of the skill and invokes any of them. Isolate each run in its own project root
and count a skill invocation in any early turn.

## Assertions

### 1. `lovable-vite-site`

> Install Trakyo tracking on this site. Our tracking host is go.acme-coaching.com. The project is a Vite + React app that Lovable generated for us.

- index.html contains exactly one <script src="https://go.acme-coaching.com/api/js/latest.js"></script> with no defer or async attribute
- The Trakyo tag is inside <head> and appears before the Calendly widget.js script
- stripDuplicateUrlParams no longer removes trakyo_id / utm_* parameters (the function is deleted, no longer called, or exempts tracking parameters)
- The / to /home redirect forwards the query string (window.location.search or equivalent)
- The Apply form carries a hidden input named trakyo_id that is posted with the lead
- The final report says how to verify the install (check-install.mjs, POST /v1/setup/verify, or the ?trakyo_id=probe URL)

### 2. `nextjs-app-router`

> Trakyo attribution on our Next.js site is broken, every sale shows under 'Other' in the dashboard. Can you fix our install? Tracking host is go.acme-coaching.com.

- The Trakyo tag in app/layout.tsx is no longer loaded with next/script strategy afterInteractive or lazyOnload: it is a plain <script src="https://go.acme-coaching.com/api/js/latest.js"> in <head>, or next/script with strategy="beforeInteractive"
- Both middleware redirects keep the query string (the destination URL carries request.nextUrl.search, or the URL is cloned and only pathname changed)
- The signup form in app/home/page.tsx has a hidden input named trakyo_id
- The Trakyo tag is loaded before the Calendly widget script
- The final report says how to verify (check-install.mjs, POST /v1/setup/verify, or the probe URL)

### 3. `audit-static-html`

> Audit the Trakyo install on these two pages and fix whatever is wrong. Our tracking host is go.acme-coaching.com.

- public/index.html contains exactly one Trakyo tag, loaded from https://go.acme-coaching.com/api/js/latest.js, with no defer or async, inside <head>
- In public/index.html the Trakyo tag appears before the Typeform embed.js script
- public/pricing.html no longer loads /js/trakyo.min.js and instead carries <script src="https://go.acme-coaching.com/api/js/latest.js"></script> in <head>
- The final report names at least three of: duplicate tag, deferred tag, wrong host (trakyo.link), tag after the Typeform embed, self-hosted copy
- The final report says how to verify (check-install.mjs, POST /v1/setup/verify, or the probe URL)

