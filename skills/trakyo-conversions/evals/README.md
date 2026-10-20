# Evals: `trakyo-conversions`

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
| `stripe-webhook-email-only` | 5/5 | 2/5 | 42 s / 34 s | 122k / 116k |
| `express-greenfield` | 5/5 | 2/5 | 48 s / 38 s | 123k / 116k |
| `thank-you-page` | 5/5 | 3/5 | 25 s / 27 s | 117k / 114k |
| **Total** | **15/15** | **7/15** | 38 s / 33 s | 120k / 115k |

Pass rate: with skill 100%, baseline 47%.

### What the runs showed

- **Where the skill earns its keep**: the API's shape. Without it the agent sends a numeric `value`,
  no `event.external_id`, no `Idempotency-Key`, invents field names (`event_type`, top-level
  `trakyo_id`) and never reads `attribution.reason`, so a `201 unattributed` would still look like
  success. On the thank-you page the baseline hand-rolled a `window.trakyo.conversion()` call that
  does not exist; the skill produced the hosted loader with `data-value` / `data-email`.
- **Every eval discriminates** here, because the baseline cannot know a private API's contract.
- **Both configurations** captured `trakyo_id` at signup from the hidden field or the cookie, so
  the capture pattern is the part a strong model infers on its own.

## Multi-model pass, 2026-10-20 (v1.2.0)

The same three tasks, one run per eval and configuration, on Claude Haiku 4.5 and
Claude Opus alongside the Sonnet 4.5 run above: same prompts, same grader (two of
its regexes were widened so a helper module, a multi-line object or a ternary
counts; the Sonnet numbers did not move). Time and tokens are with skill / baseline.

| Model | Eval | With skill | Baseline | Time | Tokens |
|---|---|---|---|---|---|
| Haiku 4.5 | `stripe-webhook-email-only` | 4/5 | 2/5 | 96 s / 91 s | 99k / 95k |
| Haiku 4.5 | `express-greenfield` | 4/5 | 0/5 | 82 s / 80 s | 99k / 94k |
| Haiku 4.5 | `thank-you-page` | 4/5 | 2/5 | 54 s / 40 s | 91k / 87k |
| **Haiku 4.5** | **total** | **12/15** | **4/15** | | |
| Sonnet 4.5 | total | 15/15 | 7/15 | 38 s / 33 s | 120k / 115k |
| Opus | `stripe-webhook-email-only` | 5/5 | 3/5 | 98 s / 151 s | 128k / 135k |
| Opus | `express-greenfield` | 5/5 | 3/5 | 98 s / 201 s | 129k / 152k |
| Opus | `thank-you-page` | 5/5 | 3/5 | 63 s / 55 s | 121k / 116k |
| **Opus** | **total** | **15/15** | **9/15** | | |

What the runs showed:

- **The Opus baseline read the public OpenAPI spec and got close.** Without the
  skill it still captured `trakyo_id`, used the session id as `external_id` and
  logged attribution in the Stripe eval; what it missed is what the spec does not
  say: on the thank-you page it invented a `window.trakyo.conversion(...)` call
  instead of the hosted snippet, and in the greenfield eval it never surfaced
  `attribution.status`. Part of its remaining gap is the grader's, which credits an
  inline `identity: { ... }` and not an identity object built elsewhere. It also
  took longer and spent more tokens than with the skill, 151 s and 201 s against
  98 s, because it went looking for the contract the skill hands it.
- **Haiku with the skill sends the right identity but drops a field each time**:
  a numeric `value` in one run, no `value` at all in another, a report that did
  not explain dedupe on the thank-you page. The baseline sent email only in every
  backend run, which is the "100% under Other" failure the skill exists to stop.

## Trigger set, 2026-10-20

`trigger-set.json` holds 20 queries: 10 that should load this skill and 10 near misses
(adjacent analytics work, the sibling skills' tasks, generic engineering). Each query ran
3 times on Claude Sonnet 4.5 in a fresh, otherwise empty project with the skill
registered as a command; a run counts as triggered when the agent invokes the skill
within its first six turns. Pass = triggered on at least 2 of 3 runs for a positive,
at most 1 of 3 for a negative.

| Description | Positives | Negatives | Total |
|---|---|---|---|
| **Iteration 1 (shipped)** | 10/10 | 9/10 | 19/20 |
| Iteration 2: iteration 1 plus an explicit "Not for …" sentence | 10/10 | 9/10 | 19/20 |

Iteration 2 did not improve the score, so the shorter iteration 1 ships. Misses of the
shipped description, all near-miss negatives:

| Query | Expected | Triggered |
|---|---|---|
| Add a thank-you page after checkout that shows the order summary | should not | 3/3 |

A sibling skill's task triggering this skill when it is the only Trakyo skill installed is
expected: there is nothing else to route to. With all three skills installed the boundary
sentence does the routing, measured on the sibling queries (3 runs each, first skill invoked):

| Query | Routed here |
|---|---|
| Send our paid orders from the Stripe webhook to Trakyo so they get attributed | 3/3 |
| A customer got a refund, how do I reverse the conversion we sent to Trakyo? | 3/3 |

Across all 18 routing runs the first skill invoked was the expected one 18 times.

Two notes on method, so the next person does not lose an hour to them: Anthropic's
`skill-creator` runner (`run_eval.py`) returns "not triggered" the moment the agent's
first tool call is anything but the skill, and Sonnet in a bare directory runs `ls`
first; and its workers share one `.claude/commands/` directory, so each agent sees six
copies of the skill and invokes any of them. Isolate each run in its own project root
and count a skill invocation in any early turn.

## Assertions

### 1. `stripe-webhook-email-only`

> Our Stripe sales reach Trakyo but the dashboard files all of them under 'Other'. Fix our Trakyo integration in this Express app.

- The signup handler captures trakyo_id (from req.body.trakyo_id or the trakyo_id cookie) and persists it on the user record
- The Stripe webhook's conversion request sends identity.trakyo_id read from the persisted user, in addition to identity.email
- event.external_id is set to the Checkout Session id (or payment intent id) and event.value is a decimal string such as "997.00", not a number
- The code reads attribution.status and attribution.reason from the response and logs them
- An Idempotency-Key header is sent on the conversion request

### 2. `express-greenfield`

> When an order is marked paid, report it to Trakyo as a purchase so it gets attributed to the right video. Add that to this Express app (app.acme-coaching.com).

- trakyo_id is read from the trakyo_id cookie (or a trakyo_id body/query field) at signup or order creation and stored on the user or order
- The paid handler POSTs to https://api.trakyo.io/v1/conversions with identity.trakyo_id
- event.external_id is the order id, event.kind is purchase, event.value is a decimal string and event.currency is set
- An Idempotency-Key header is sent
- attribution.status / attribution.reason from the response is logged or otherwise surfaced

### 3. `thank-you-page`

> Track purchases from this funnel thank-you page in Trakyo. The conversion id from the Trakyo dashboard is cnv_7f3a9 and our tracking host is go.acme-coaching.com.

- thank-you.html loads the hosted conversion loader https://go.acme-coaching.com/api/js/c/cnv_7f3a9.js
- The loader is given data-value from {{order_total}} and data-email from {{contact.email}}
- The site-wide tag <script src="https://go.acme-coaching.com/api/js/latest.js"></script> is unchanged, present once, without defer or async
- No Trakyo API key or direct browser POST to /v1/conversions appears in the HTML
- The report explains that the order id on the confirmation URL (session_id) or in a data attribute is what makes the conversion idempotent

