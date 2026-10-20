# Forms, booking widgets and checkouts

On a page that carries the Trakyo tag, the script tags the vendors below on its own:
it patches `document.createElement`, watches `iframe.src` / `srcdoc` and anchor
`href`s, and re-scans the page every 2 seconds. Nothing needs to be configured for
these as long as the tag loads **before** the embed (see the shape rules).

## Vendors tagged automatically

| Vendor | How the id travels | Note |
|---|---|---|
| Calendly | `utm_term=<trakyo_id>` on the embed URL and on plain links | Calendly drops unknown params, so `trakyo_id` would be lost; `utm_term` is its native tracking slot. Keep the Calendly webhook connected in Trakyo. |
| iClosed | `utm_term=<trakyo_id>` | Same reason as Calendly. |
| Typeform | `trakyo_id=<id>` on the embed URL | Add a hidden field named `trakyo_id` in the Typeform. |
| Tally | `trakyo_id=<id>` | Add a hidden field named `trakyo_id`. |
| AEvent | `trakyo_id=<id>`, including inside `srcdoc` payloads | |
| GoHighLevel (LeadConnector) | `trakyo_id=<id>` on form/calendar widget URLs, including URLs in `srcdoc` JS strings | Also fills `input[name="trakyo_id"]` on native GHL forms. |
| HubSpot Meetings | `trakyo_id=<id>` on `meetings*.hubspot.com` | |
| Framer | `data-trakyo-id` injected into Framer `srcdoc` custom-code iframes | Framer isolates custom code in `srcdoc` iframes with no cookie access; the injection is what bridges it. |

## Hidden inputs the script fills

Give any custom or page-builder form a hidden input and the script fills it with the
visitor id (and fires `input` / `change` / `blur` so React/Vue/Webflow forms notice):

```html
<input type="hidden" name="trakyo_id" value="">
```

Selectors recognised today:

- `input[name="trakyo_id"]`, `input[data-custom-type="trakyo_id"]` (ClickFunnels, GHL, generic)
- `input[name="fields[trakyo_id]"]` (Kit / ConvertKit)
- `input[name="form_fields[trakyo_id]"]`, `input[id="form-field-trakyo_id"]` (Elementor)
- `input[data-name="trakyo_id"]` (Thrive Architect, Webflow forms with a field named `trakyo_id`)
- Kajabi: add a custom field **titled** `trakyo_id` on the form or checkout; the
  script finds it by its rendered placeholder and hides it.

Then send that field with the submission to the account's custom-form webhook
(dashboard → Integrations → Custom Form) or into the CRM field Trakyo reads.

## Reading the id in your own code

```js
window.trakyo_id                  // set once trakyo.js has run
document.cookie                   // trakyo_id=...  (90 days, apex-scoped)
localStorage.getItem("trakyo_id") // fallback
```

Read it **at submit time**, not at page load: on a first visit the id arrives a few
hundred milliseconds after the tag runs.

## Plain links and cross-domain hops

- A plain `<a href="https://calendly.com/...">` is decorated with `utm_term` by the
  script. Other vendors in the table get `trakyo_id`.
- Links to the site's own apex and subdomains are decorated with `trakyo_id`
  automatically, so `www.site.com` → `app.site.com` is covered.
- A link to a **different registrable domain** (a separate checkout domain, a
  partner page) is not. Append `trakyo_id` yourself from `window.trakyo_id` or the
  cookie, in a click handler or when you build the URL.

## Single-page apps

`pushState` / `replaceState` are patched and the link scan re-runs on every route
change, so client-side navigation keeps working. The one thing that breaks it is
code that rewrites the URL to drop query params on mount; see the install rules.
