---
name: trakyo-install
description: Install the Trakyo tracking tag on a website correctly, or audit an existing install. Use when asked to "install Trakyo", "add the tracking script", "set up Trakyo tracking", "add trakyo.js", or when attribution / tracking "isn't working", "stopped working", or sales show up under "Other". Covers the exact tag shape (blocking, in <head>, once), parameter forwarding (trakyo_id, tclid, utm_*), booking/form embeds, and verification with POST /v1/setup/verify.
license: MIT
metadata:
  author: trakyo
  version: "1.0"
  docs: https://trakyo.io/docs
---

# Install Trakyo tracking

Trakyo attributes form submissions, bookings and payments to the YouTube video,
ad or link that earned them. It works by loading one script on every page of the
site, which sets a first-party visitor id (`trakyo_id`) and passes it into every
form, booking widget and checkout the visitor touches.

**The whole install is one script tag, in one shape, on every page.** Most broken
installs are the right tag in the wrong shape.

## 1. Get the tag

Ask for the account's **tracking host** (Trakyo dashboard → *Custom Domains*; it looks
like `go.customer.com`). If there is none yet, `trakyo.link` works as a fallback.

The tag is exactly this, with HOST substituted:

```html
<!-- Trakyo -->
<script src="https://HOST/api/js/latest.js"></script>
```

Rules, each with the reason, because the "obvious" improvements are the bugs:

| Rule | Why |
|---|---|
| **No `defer`** | A deferred script runs after HTML parsing. Every booking / form vendor (Calendly, Typeform, iClosed, Tally, GHL, HubSpot) ships an `async` embed that builds its iframe first; Trakyo then has to reload that iframe with the visitor id, which resets the widget and loses any booking finished before the reload. |
| **No `async`** | Still a race; loses whenever Trakyo's fetch is slower than the vendor CDN. A plain blocking tag is the only remote shape that reliably wins. Measured cost: about 3 ms at a typical 40 ms fetch. |
| **In `<head>`**, above any booking/form embed and above the app bundle | The script must run before anything that builds an iframe, reads the URL, or rewrites it. |
| **Exactly once per page** | Duplicates double-count visits and race each other's cookie writes. Check layouts, templates, GTM and `index.html` for a second copy. |
| **Never self-host** | The script lives at `/api/js/latest.js` so fixes ship without anyone re-pasting. A local copy freezes the site on whatever version was downloaded. |
| **Load from the account's own host** | A tag that loads from another account's host sends events to the wrong account. |

Do not wrap it in a tag manager, a consent gate, or a lazy loader unless the site
already gates *every* analytics script that way. If it must be gated, load it
synchronously the moment consent is granted and before any embed renders.

## 2. Keep the visitor id alive across navigation

The script reads `?trakyo_id=` (and `?tclid=`) off the landing URL and stores it
in a 90-day apex-scoped cookie plus `localStorage`, so `www.`, apex and
subdomains share one id. Everything after that depends on the id not being thrown
away:

- **Every redirect keeps the query string.** Router redirects (`/` → `/home`),
  trailing-slash and `www` canonicalisation, locale redirects, `index.tsx`
  redirects: all of them forward `location.search`. A redirect that drops it
  drops `trakyo_id`, `tclid`, `utm_*`, `fbclid` and every attribution that came
  with the click.
- **Never "clean" the URL.** No `history.replaceState` that strips query params,
  no canonical-URL helper that removes `trakyo_*` keys, no "strip duplicate
  params" SEO code. Canonical `<link>` tags handle SEO; the address bar is not
  the problem.
- **Single-page apps**: the script patches `pushState`/`replaceState` and
  re-scans links every 2 s, so client routing is fine. What is not fine is a
  framework that rewrites the URL on mount (see the rule above).
- **Cross-domain hops** (site → separate checkout/app domain): append
  `trakyo_id` to the outgoing link. Read it from `window.trakyo_id`, or the
  `trakyo_id` cookie. The script already does this for links to the site's own
  apex and subdomains, and for known vendors; a *different* registrable domain
  needs it done by the site.
- **Do not persist `trakyo_id` in your own storage and write it back** (for
  example a first-touch "RevTrack"-style store that re-applies a saved value).
  It overwrites the current id with a stale one.

## 3. Forms, booking widgets and checkouts

The script auto-tags the vendors it knows (Calendly, Typeform, iClosed, Tally,
AEvent, GoHighLevel, HubSpot Meetings, Framer embeds, Kajabi, Kit, Elementor,
ClickFunnels, Thrive) when they are **embedded on a page that has the tag**.
Details and the hidden-field names per vendor: [references/embeds.md](references/embeds.md).

For anything custom:

- Give every lead-capturing form a hidden input named `trakyo_id`; the script
  fills it. Post it along with the lead to the account's custom-form webhook or
  CRM.
- A booking or checkout reached by a **plain link** to another domain must carry
  the id in the URL (section 2). Calendly and iClosed read it as `utm_term`;
  every other vendor reads `trakyo_id`.
- A purchase recorded on a **server** (payment webhook, CRM) must be sent to
  Trakyo with `identity.trakyo_id`; see the `trakyo-conversions` skill. Email
  alone identifies the person, not the journey, and lands under "Other".

## 4. Content-Security-Policy

If the site sets a CSP, allow the tracking host:

```
script-src https://HOST; connect-src https://HOST; worker-src blob:
```

## 5. Platform notes

Where the tag goes on each builder, and the builder-specific traps (Webflow drops
query strings on internal links; Lovable/v0 emit URL-cleaning code; Framer wraps
custom code in `srcdoc` iframes): [references/platforms.md](references/platforms.md).

## 6. Self-check before saying "done"

Re-read what you changed against the eight codes in
[references/checks.md](references/checks.md). They are the same codes the verify
endpoint returns, so a self-check that passes here passes there. In particular:
the tag has no `defer`/`async`, sits in `<head>` above every embed, appears once,
and no redirect or URL-cleanup you touched drops the query string.

## 7. Verify on the live site

With an API key that has `links:read` (dashboard → *API & MCP*):

```bash
curl -s https://api.trakyo.io/v1/setup/verify \
  -H "Authorization: Bearer tky_live_..." -H "Content-Type: application/json" \
  -d '{"url":"https://www.customer.com/"}'
```

Read the response like this:

- `status`: `ok` is done. `degraded` / `broken` / `not_installed`: apply every
  `findings[].fix` verbatim (each is the literal markup, already filled in with
  the account's host) and re-run.
- `unknown` means **could not determine**, never "broken". JS-rendered shells
  (Vite/React builds from Lovable, v0, Bolt) come back `unknown` because the tag
  is injected at runtime; judge those by `recent_activity` and the dashboard.
- `recent_activity` is "this domain sent us an event in the last 24 h". It is an
  account+domain signal, not proof that this exact page works.

Without an API key: open the site once in a normal browser, then check the
Trakyo dashboard → *Custom Domains* → the domain shows a recent event.

To check URL handling without recording a visit, open
`https://www.customer.com/?trakyo_id=probe-<random>` in a fresh browser context.
A `trakyo_id` on the landing URL is treated as "arrived from a tracking link": the
tag stores that id and tags links and embeds with it, but posts **no visit**.
Confirm the query string survives every redirect, `window.trakyo_id` equals the
probe, and the probe appears on every booking link, embed `src` and checkout URL
on the page. (`&trakyo-no-track=1` goes further and makes the tag do nothing at
all; use it only to test that the *site's own* redirects keep the query string.)

## 8. Done means

1. The tag is on every page of every funnel domain, in the shape above.
2. `/v1/setup/verify` returns `ok` (or `unknown` with `recent_activity: true`
   for a client-rendered app).
3. A probe id survives the site's redirects and reaches its forms, embeds and
   checkout links.

Tell the user which domains were checked, what was changed, and anything that
could not be verified (a page behind login, a consent wall, a separate checkout
domain you did not have access to).
