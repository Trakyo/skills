# Where the tag goes, per platform

The tag is the same everywhere; only the place you paste it changes. Paste it as
is: no `defer`, no `async`, once, in `<head>` above booking/form embeds.

```html
<!-- Trakyo -->
<script src="https://HOST/api/js/latest.js"></script>
```

| Platform | Where | Trap |
|---|---|---|
| **Plain HTML / static site** | `<head>` of every page, or the shared layout/partial. | A second copy in a footer include. |
| **Next.js** | `app/layout.tsx` → `<head>`: render a plain `<script src="https://HOST/api/js/latest.js" />`. Do **not** use `next/script` with `strategy="afterInteractive"` or `lazyOnload` (both defer). `strategy="beforeInteractive"` in the root layout is acceptable. | `next.config` `redirects()` entries drop the query string unless the destination keeps it; middleware redirects must copy `request.nextUrl.search`. |
| **Vite / React / Vue SPA (Lovable, v0, Bolt, Cursor-generated)** | `index.html` → `<head>`, **above** the `<script type="module" src="/src/main.tsx">` line. | Generated "canonical URL" / "strip duplicate params" helpers that call `history.replaceState` and remove `trakyo_id`. Delete them. Router `redirect()` calls must carry the search string (`throw redirect({ href: \`/home${location.searchStr}\` })` in TanStack Router; `<Navigate to={{ pathname, search }}>` in React Router). |
| **Webflow** | Project Settings → Custom Code → **Head Code**. | Webflow's internal links and form redirects drop the query string. If a downstream checkout on another domain needs `trakyo_id`, forward it in a small inline script (read `window.trakyo_id` / cookie at click time). Webflow forms: add a hidden field named `trakyo_id`. |
| **Framer** | Site Settings → General → Custom Code → **Start of `<head>`**. | Custom-code embeds render inside `srcdoc` iframes with no cookie access; the script injects `data-trakyo-id` into them, but only when the tag is in the site head, not inside the embed. |
| **WordPress** | Theme `header.php` before `</head>`, or a "header scripts" plugin field. Elementor forms: hidden field with id `trakyo_id`. Thrive: field name `trakyo_id`. | Caching/optimisation plugins (WP Rocket, LiteSpeed, Autoptimize) that add `defer`/`async` to every script or inline-combine them. Exclude `latest.js`. |
| **Shopify** | `theme.liquid` → `<head>`. For checkout attribution use the Trakyo Shopify/Stripe integration or server-side conversions; the checkout domain is Shopify's. | Theme app extensions that re-inject scripts on every section load (duplicates). |
| **ClickFunnels** | Funnel Settings → Head Tracking Code (applies to every step), above any embedded calendar. Hidden field `trakyo_id` on the opt-in. | Per-step head code that pastes it a second time. |
| **GoHighLevel funnels / sites** | Site/Funnel Settings → Tracking Code → **Head**. Paste it above any booking-widget embed in the same box. | GHL server-renders custom-code elements into the HTML, so the tag in Head Tracking Code can still run after a calendar embed placed higher on the page; put the tag above the embed element if a booking resets. |
| **Kajabi** | Settings → Site Details → Page Scripts → **Header**. Add a custom field titled `trakyo_id` to opt-in forms and checkouts (the script hides it). | Kajabi has no hidden-field type; the title is how the script finds the field. |
| **Squarespace** | Settings → Advanced → Code Injection → **Header**. | Squarespace strips query params on some internal redirects; test with a probe id. |
| **Wix** | Settings → Custom Code → Head, load "on all pages". | Wix's "Code type: essential" is required or consent settings may delay it. |
| **Google Tag Manager** | Prefer **not** to: a GTM Custom HTML tag injects the script after the container loads, which loses the race to embeds. If GTM is the only option, fire it on *Consent Initialization* / *Initialization*, not *Page View*. | The verify endpoint reports a GTM-injected tag as `unknown` with `recent_activity: true`; that is expected. |
| **Lovable / AI builder prompt** | If you are the builder: add the tag to `index.html` head, remove any URL-cleaning code, make every redirect keep the query string, and add a hidden `trakyo_id` field to forms. Say so in the project's `AGENTS.md` so the next edit does not undo it (see the `trakyo-tracking-guard` skill). | The next prompt. |

## Separate app / checkout domains

Many sites hand off to an app on another host (`app.customer.com`, a separate
checkout domain). Two rules:

1. Install the tag there too. On a subdomain of the same apex the visitor keeps the
   same id (the cookie is apex-scoped), so pages inside the app are tracked and
   repeat purchases stay attributed.
2. If the app's backend records the signup or purchase, send it to Trakyo with
   `identity.trakyo_id` (read the `trakyo_id` cookie server-side on the same apex,
   or the `?trakyo_id=` the site forwarded). See the `trakyo-conversions` skill.
