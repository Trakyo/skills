# Thank-you page conversions

For a purchase whose confirmation page is rendered in the buyer's browser (a funnel
builder redirecting to `/thank-you`), Trakyo provides a hosted per-conversion
loader. Create the conversion in the dashboard (*Conversions → Custom Conversions*),
copy the snippet it generates, and paste it on the confirmation page:

```html
<!-- Trakyo Conversion -->
<script src="https://HOST/api/js/c/<conversion-id>.js" defer></script>
```

This one **may** be `defer`: it fires after the page is ready, and the site-wide tag
has already set the visitor id. The loader lazy-loads `trakyo.js` if it is missing,
reads its own `data-*` attributes, and calls `trakyo.trackConversion`.

## Pass what the page knows

Funnel builders template order details into the redirect. Add them as attributes so
the conversion carries the real value and resolves to a real person:

```html
<script src="https://HOST/api/js/c/<conversion-id>.js"
        data-value="{{order_total}}"
        data-email="{{contact.email}}"
        data-phone="{{contact.phone}}"
        defer></script>
```

The loader also reads the confirmation URL on its own, case-insensitively and
ignoring `_`/`-`: `session_id`, `checkout_session_id`, `order_id`, `sale_id`,
`payment_id`, `external_id` for the order id (Stripe's
`?session_id={CHECKOUT_SESSION_ID}` is the canonical one), and `email`,
`customer_email`, `phone`, `customer_phone`, `name` for identity.

## Dedupe

An order id is what makes the conversion idempotent across tabs, devices and
link-preview crawlers. Always get one onto the confirmation URL (or into
`data-*`). Without it, only a per-session key in `sessionStorage` protects against
a double fire.

## When not to use it

If the sale is already known to a server (a payment webhook, an order service),
use `POST /v1/conversions` instead: it is exact, it carries `external_id` for
reversals, and it does not depend on the buyer reaching the confirmation page.
