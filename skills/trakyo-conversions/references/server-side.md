# `POST /v1/conversions`

Scope: `conversions:write` on the API key (dashboard → *API & MCP*). Base URL
`https://api.trakyo.io`. Full reference: https://trakyo.io/docs/conversions and the
OpenAPI spec at https://api.trakyo.io/openapi.json.

Contents: [Request](#request) ([identity](#identity), [event](#event)) ·
[Response](#response) · [Batch](#batch) · [Reversals](#reversals) ·
[Do not double-record](#do-not-double-record) ·
[Minimal server-side pattern](#minimal-server-side-pattern)

## Request

```bash
curl https://api.trakyo.io/v1/conversions \
  -H "Authorization: Bearer tky_live_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8f2c1a90-..." \
  -H "X-Trakyo-Skill: trakyo-conversions@1.2.0" \
  -d '{
    "identity": {
      "trakyo_id": "9f2c8b1e-...",
      "email": "buyer@example.com",
      "external_id": "crm-14931"
    },
    "event": {
      "kind": "purchase",
      "external_id": "ord_8412",
      "name": "Annual plan",
      "value": "997.00",
      "currency": "USD",
      "payment_processor": "stripe",
      "occurred_at": "2026-08-18T12:04:11Z"
    }
  }'
```

### `identity`

At least one of `trakyo_id`, `click_id`, `email`, `phone`. Match order when several
are present: email → phone → fingerprint → click.

| Field | Match key | Carries attribution | Notes |
|---|---|---|---|
| `trakyo_id` | yes | **yes** | The visitor id from `window.trakyo_id` / the `trakyo_id` cookie. |
| `click_id` | yes | **yes** | The `tclid` minted at short-link redirect. |
| `email` | yes (highest) | only if already a known lead with a tracked click | |
| `phone` | yes | same | **E.164 only** (`+14155550123`). |
| `name` | no | no | |
| `external_id` | **no** | **no** | Your CRM id, stored for reference. |

### `event`

| Field | Required | Notes |
|---|---|---|
| `kind` | yes | `purchase`, `signup`, `booking`. |
| `external_id` | yes | Your order / invoice / registration id. Dedupe key and reversal handle. |
| `name` | no, but send it | Form name for signups; label for purchases. |
| `value` | purchases | Decimal string, `> 0`. Or send `conversion_id` of a saved Custom Conversion and omit `value`. |
| `currency` | no | ISO-4217, default `USD`. Crypto is rejected (`unsupported_currency`): convert first. |
| `payment_processor` | no | Shown as the payment type in the dashboard (`stripe` → "Stripe (API)"). |
| `occurred_at` | no | When it really happened; last 30 days, not in the future. |
| `metadata` | no | Free-form object, stored on the event. |

## Response

```json
{
  "object": "conversion",
  "id": "cnv_...",
  "external_id": "ord_8412",
  "lead_id": "lead_...",
  "kind": "purchase",
  "value": "997.00",
  "currency": "USD",
  "amount_usd": "997.00",
  "occurred_at": "2026-08-18T12:04:11Z",
  "attribution": { "status": "attributed", "reason": null, "content_item_id": "ci_..." }
}
```

`201` on create. `200` with `Idempotent-Replayed: true` when `event.external_id`
already existed (the stored conversion is returned, nothing is double-counted).

## Batch

`POST /v1/conversions/batch` takes `{ "conversions": [ ...up to 1000 items... ] }`,
each item the same shape as above, and returns `200` with a per-item `results`
array (`created`, `replayed`, or `error` with `code` / `message` / `param`). One bad
item never rejects the rest. Use it for backfills; `external_id` dedupe makes
re-sending safe.

## Reversals

`POST /v1/conversions/{external_id}/reversals` with
`{ "external_id": "<refund id>", "value": "997.00", "occurred_at": "..." }` for a
partial or full refund. The path `external_id` is the original order; the body
`external_id` is the refund / chargeback id and dedupes the reversal itself.
The original keeps its attribution; `amount_reversed` and `fully_reversed` update.

## Do not double-record

If the account has a direct integration connected (Stripe, Whop, Kajabi, Commas,
Teachable), do not also send those sales here: `external_id` dedupes within this
endpoint only, so the sale would be counted twice.

## Minimal server-side pattern

```ts
// 1. capture at signup / checkout (same apex as the tagged site)
const trakyoId =
  req.cookies.trakyo_id ??            // apex-scoped cookie, set by trakyo.js
  req.body.trakyo_id ??               // hidden form field
  new URL(req.headers.referer ?? "", "https://x").searchParams.get("trakyo_id") ??
  null;
await db.users.update(userId, { trakyo_id: trakyoId ?? existing });   // keep first non-empty

// 2. send on every conversion for that user
await fetch("https://api.trakyo.io/v1/conversions", {
  method: "POST",
  headers: { Authorization: `Bearer ${TRAKYO_KEY}`, "Content-Type": "application/json",
             "Idempotency-Key": order.id, "X-Trakyo-Skill": "trakyo-conversions@1.2.0" },
  body: JSON.stringify({
    identity: { trakyo_id: user.trakyo_id ?? undefined, email: user.email, external_id: user.id },
    event: { kind: "purchase", external_id: order.id, name: order.product,
             value: order.total.toFixed(2), currency: order.currency,
             payment_processor: order.psp, occurred_at: order.paidAt },
  }),
}).then(async (r) => {
  const body = await r.json();
  log.info({ status: r.status, attribution: body.attribution }, "trakyo conversion");
});
```
