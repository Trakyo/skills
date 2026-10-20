# Funnel thank-you page

`thank-you.html` is the order-confirmation step of our ClickFunnels-style funnel.
The builder templates `{{order_total}}`, `{{contact.email}}` and
`{{contact.first_name}}` into the page and redirects the buyer here after payment
as `/thank-you?session_id={CHECKOUT_SESSION_ID}` (Stripe Checkout).
