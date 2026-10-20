const express = require("express");
const cookieParser = require("cookie-parser");
const { orders, users } = require("./store");

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Signup form on the marketing site (same apex: www.acme-coaching.com -> app.acme-coaching.com)
app.post("/signup", (req, res) => {
  const user = users.create({ email: req.body.email, name: req.body.name });
  res.cookie("uid", user.id, { httpOnly: true, secure: true, sameSite: "lax" });
  res.redirect(303, "/dashboard");
});

// Checkout: creates a pending order, then the payment provider calls /orders/:id/paid
app.post("/orders", (req, res) => {
  const user = users.get(req.cookies.uid);
  if (!user) return res.status(401).end();
  const order = orders.create({ userId: user.id, plan: req.body.plan, amountCents: req.body.plan === "pro" ? 99700 : 29700, currency: "USD" });
  res.json({ id: order.id, checkoutUrl: `https://checkout.acmepay.com/pay/${order.id}` });
});

// Called by our payment provider's webhook (already signature-verified upstream)
app.post("/orders/:id/paid", (req, res) => {
  const order = orders.markPaid(req.params.id, { paidAt: new Date(), providerRef: req.body.payment_id });
  if (!order) return res.status(404).end();
  res.json({ ok: true });
});

app.listen(3000, () => console.log("listening on 3000"));
