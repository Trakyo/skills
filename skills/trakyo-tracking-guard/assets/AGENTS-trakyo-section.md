## Tracking: do not break Trakyo

This site is tracked by Trakyo (https://trakyo.io). It attributes signups, bookings
and payments to the YouTube video, ad or link that earned them. The whole mechanism
is below; every rule exists because an edit once broke it.

**Tracking host:** `HOST` (replace, e.g. `go.customer.com`)
**Tagged domains:** `www.customer.com` and `app.customer.com` (replace)

### How it works

1. Visitors arrive through Trakyo links (`https://HOST/<slug>`) or ads and land on
   this site with `?trakyo_id=...` (and sometimes `?tclid=`, `utm_*`, `fbclid`).
2. The tag `<script src="https://HOST/api/js/latest.js"></script>` in `<head>` reads
   those parameters, sets a 90-day first-party cookie `trakyo_id` scoped to the apex
   domain, exposes `window.trakyo_id`, and injects the id into every form, booking
   widget and internal link it finds.
3. Signups and purchases reach Trakyo with that id (hidden form field, or
   `identity.trakyo_id` on `POST https://api.trakyo.io/v1/conversions` from the
   backend). Without the id a conversion is recorded but attributed to nobody
   ("Other").

### Rules

1. **The tag stays exactly as is**, once, in `<head>`, above the app bundle and above
   any booking/form embed. No `defer`, no `async`, no tag manager, no lazy loader,
   no self-hosted copy. (Reasons: it must win the race against vendor embeds; a
   local copy never receives fixes.)
2. **Every redirect keeps the query string.** Router redirects, `/` → `/home`,
   trailing slash, `www`/apex canonicalisation, locale redirects. Forward
   `location.search` (or the framework's equivalent) on every one.
3. **Never strip or rewrite tracking parameters.** No `history.replaceState` that
   "cleans" the URL, no canonical-URL helper that removes `trakyo_id` / `trakyo_uid`
   / `tclid` / `utm_*` / `fbclid`. Canonical `<link>` tags handle SEO.
4. **Hidden `trakyo_id` input on every lead-capturing form**, posted with the lead.
   The tag fills it. A new form without it loses attribution.
5. **Links to a separate checkout/app domain carry the id.** Read
   `window.trakyo_id` or the `trakyo_id` cookie at click time and append
   `trakyo_id=` to the URL. (Links within this site's own apex are handled by the
   tag.)
6. **Backend conversions send `identity.trakyo_id`.** Capture it at signup/checkout
   (cookie on the same apex, hidden field, or forwarded `?trakyo_id=`), persist it
   on the user, send it on every `POST /v1/conversions` (signup and every
   purchase). Log `attribution.reason` from the response; a `201` can still be
   unattributed.
7. **Do not store `trakyo_id` in your own first-touch persistence and write it
   back** over the live value.
8. **Content-Security-Policy**, if any, allows `https://HOST` in `script-src` and
   `connect-src`, and `blob:` in `worker-src`.

### Verify before every deploy

```bash
node scripts/check-install.mjs https://www.customer.com/ https://www.customer.com/pricing \
     --host HOST --probe                      # static rules + redirect/query checks
# authoritative, with an API key that has links:read:
node scripts/check-install.mjs https://www.customer.com/ --host HOST --api-key "$TRAKYO_API_KEY"
```

Manual, no data pollution: in a fresh browser context open
`https://www.customer.com/?trakyo_id=probe-<random>`. A `trakyo_id` on the landing
URL is treated as "arrived from a tracking link": the tag stores it, tags every
link and embed with it, and posts **no visit**. Confirm the address bar still
carries the parameter after the page settles, `window.trakyo_id` equals the probe,
and every checkout/booking link on the page contains it.
(`&trakyo-no-track=1` makes the tag do nothing at all, including link tagging;
use it only to check that the site's own redirects keep the query string.)

### If something looks wrong

Trakyo dashboard → Custom Domains shows the last event per domain. `POST
/v1/setup/verify` returns the finding and the exact markup to paste. Attribution
questions: support@trakyo.io.
