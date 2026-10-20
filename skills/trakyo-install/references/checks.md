# The eight static install checks

These are the finding codes `POST /v1/setup/verify` returns. Each `fix` the endpoint
sends is the literal markup to paste, already filled in with the account's host.
Run the same list against your own output before you report an install as done.

| Code | Severity | What it means | Fix |
|---|---|---|---|
| `SCRIPT_MISSING` | critical | No Trakyo tag in the served HTML. Nothing on the page is tracked. | Add `<script src="https://HOST/api/js/latest.js"></script>` in `<head>`. |
| `SCRIPT_SELF_HOSTED` | critical | A copy of `trakyo.js` served from the site's own origin. Frozen on whatever version was downloaded; misses every future fix. | Replace with the hosted tag. |
| `SCRIPT_WRONG_HOST` | critical | The tag loads from a host that is not a tracking host on this account. Events go to the wrong place. | Load from the account's own host (dashboard → Custom Domains). |
| `SCRIPT_DEFERRED` | critical | Tag has `defer`. Loses the race to every `async` vendor embed; bookings reset or go unattributed. | Remove `defer`. |
| `SCRIPT_ASYNC` | critical | Tag has `async`. Same race, still lost whenever the vendor CDN is faster. | Remove `async`. |
| `SCRIPT_AFTER_VENDOR_EMBED` | critical | A Calendly / Typeform / iClosed / Tally / AEvent / HubSpot / GHL embed is loaded before the Trakyo tag. | Move the Trakyo tag above the embed. |
| `SCRIPT_DUPLICATE` | warning | The tag appears more than once. Double-counted visits, racing cookie writes. | Keep exactly one. Check layouts, templates, GTM. |
| `SCRIPT_NOT_IN_HEAD` | warning | Tag is in `<body>`. Runs, but after anything in `<head>` that redirects or embeds. | Move to `<head>`. |

## Status values

| `status` | Meaning | What to do |
|---|---|---|
| `ok` | Correct shape, domain is sending data. | Done. |
| `degraded` | Working, but a warning above applies. | Apply the fixes. |
| `broken` | A critical finding, or a correct-looking tag on a domain that has sent nothing in 24 h. | Apply the fixes; if there are none, the tag is not running (consent gate? CSP? GTM not publishing?). |
| `not_installed` | No tag found and no recent data. | Install it. |
| `unknown` | Could not determine: JS-rendered shell, bot challenge, timeout, consent wall. **Never report this as broken.** | Use `recent_activity` and the dashboard instead. |

## What the static checks cannot see

They read the served HTML and do not execute JavaScript, so they cannot tell you:

- whether a redirect or `history.replaceState` strips the query string
  (check by hand with `?trakyo_id=probe-<random>` in a fresh browser context: the
  tag stores the id and tags links with it but posts no visit);
- whether a client-rendered app injects the tag at runtime (`unknown`);
- whether an embed on the page actually received the id (open the embed's iframe
  `src` in devtools and look for `trakyo_id=` or `utm_term=`).
