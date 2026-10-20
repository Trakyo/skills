# PR #42: SEO cleanup, locale redirect, new checkout button, newsletter form

- `src/lib/seo.ts`: new `cleanUrl()` so shared links do not carry tracking junk
  (Google was indexing `?utm_source=` variants of the home page).
- `src/router.tsx`: visitors from `/` are now sent to `/en` (locale prefix) so we
  can add `/de` next month.
- `src/components/CheckoutButton.tsx`: new "Buy Pro" button to our checkout
  provider at checkout.acmepay.com.
- `src/components/NewsletterForm.tsx`: new footer newsletter form posting to our
  CRM webhook.

Deploy: merge to main, Netlify builds www.acme-coaching.com.
