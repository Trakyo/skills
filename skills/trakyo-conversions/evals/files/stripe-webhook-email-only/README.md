# acme-coaching-api

Express + Stripe Checkout. The marketing site (www.acme-coaching.com, tracked by
Trakyo, host go.acme-coaching.com) posts its signup form here; Stripe Checkout
sessions are created from the app and the webhook marks users paid.

Schema: `users(id, email unique, name, paid_session_id, created_at)`.
