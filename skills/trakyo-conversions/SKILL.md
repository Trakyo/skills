---
name: trakyo-conversions
description: Report purchases, signups and bookings to Trakyo from a backend (POST /v1/conversions) or a thank-you page, attributed to the click or visit that earned them. Use when asked to "send conversions to Trakyo", "track purchases", "report sales", "integrate the Trakyo API", "connect our payment webhook", or when Trakyo revenue shows under "Other", is unattributed, or payments from the API are not matching leads.
license: MIT
metadata:
  author: trakyo
  version: "1.0"
  docs: https://trakyo.io/docs/conversions
---

# Send conversions to Trakyo

A conversion is a `purchase`, `signup` or `booking` that your system knows about.
There are two ways to report it:

| Where the outcome is known | Use |
|---|---|
| Your backend (payment webhook, CRM, order service) | `POST /v1/conversions` ([references/server-side.md](references/server-side.md)) |
| A confirmation / thank-you page in the visitor's browser | The hosted conversion snippet ([references/thank-you-page.md](references/thank-you-page.md)) |

Both are attributed only if they carry the visitor's id. **That one rule decides
whether the revenue lands on a video, an ad, a link, or under "Other".**

## The one rule: send `identity.trakyo_id`

`trakyo.js` sets `trakyo_id` on every page it runs on: `window.trakyo_id`, a 90-day
apex-scoped cookie named `trakyo_id`, and `localStorage`. It is the **visitor** id.

- `identity.trakyo_id` and `identity.click_id` **carry attribution**. They were
  present while the person browsed, so they link the conversion to the click.
- `identity.email` and `identity.phone` **identify the person** (they are the
  highest-precedence match keys) but carry no journey. An email-only conversion
  whose buyer was never a known lead opens a brand-new lead with no history and is
  reported under **Other**. The request still returns `201`; nothing fails.
- `identity.external_id` is your CRM id. Stored for reference only. Not a match
  key, not attribution. Do not send it *instead of* `trakyo_id`.

Send `trakyo_id` **and** the email together whenever you have both: email merges the
conversion into the person's history, `trakyo_id` supplies the attribution.

## Getting `trakyo_id` to the backend

1. **Capture** it in the browser at signup or checkout. Options, best first:
   - the backend reads the `trakyo_id` cookie from the request. It is apex-scoped,
     so `app.customer.com` receives a cookie set on `www.customer.com`;
   - a hidden input named `trakyo_id` on the form (trakyo.js fills it);
   - `window.trakyo_id` in the submit handler;
   - the `?trakyo_id=` query parameter the landing site forwarded to the app.
2. **Persist** it on the user / order row, so a payment webhook that fires minutes
   or days later can still find it. Keep the first non-empty value; do not
   overwrite with a later blank.
3. **Send** it as `identity.trakyo_id` on every conversion for that user: the
   signup *and* every later purchase, including repeat purchases.

If traffic arrives through Trakyo short links you may also send
`identity.click_id` (the `tclid` on the landing URL or the host-scoped
`trakyo_click_id` cookie). Most visitors have a `trakyo_id`; only short-link
traffic has a `click_id`. Reach for `trakyo_id` first.

## Read the attribution block on every response

Every response (and every batch item) carries:

```json
"attribution": { "status": "unattributed", "reason": "no_attribution_identifier", "content_item_id": null }
```

| `reason` | What happened | Whose problem |
|---|---|---|
| `no_attribution_identifier` | Neither `trakyo_id` nor `click_id` was sent. | Yours: capture and send one. |
| `visitor_not_recognised` | One was sent but matches no browsing history: stale, blank, or from another site. | Yours: check where you read it and that the tag is on the pages the buyer saw. |
| `no_tracked_touch` | The visitor is known and browsed, but never came through a tracked link, ad or video. | Not an integration bug. More traffic through tracked links, or connect the ad platform. |

Log `attribution.status` and `reason` in your integration from the first call. A
`201` with `unattributed` on every row is the failure mode this skill exists to
prevent, and nothing else will tell you.

## Shape, dedupe, reversals

- `event.external_id` is **required**: your order / invoice id. It dedupes (a second
  call with the same id returns the first with `200` and `Idempotent-Replayed: true`)
  and is the handle for refunds (`POST /v1/conversions/{external_id}/reversals`).
  Different from `identity.external_id`.
- Money is a **decimal string** (`"997.00"`) in an ISO-4217 currency. Crypto is
  rejected: convert at your settlement rate and send that.
- `occurred_at` must be within the last 30 days.
- Send an `Idempotency-Key` header on every request, and use
  `POST /v1/conversions/batch` (up to 1000 items, partial success) for backfills.
- `event.name` becomes the form name for signups and the conversion label for
  purchases. Send it.

Full request/response and the batch endpoint: [references/server-side.md](references/server-side.md).

## Done means

1. Every signup and purchase path sends `identity.trakyo_id` (plus email when known).
2. A test conversion from a browser that has visited a tagged page returns
   `attribution.status: "attributed"` or `reason: "no_tracked_touch"`; it never
   returns `no_attribution_identifier`.
3. Your logs record `attribution.reason` so a regression shows up the day it ships.
