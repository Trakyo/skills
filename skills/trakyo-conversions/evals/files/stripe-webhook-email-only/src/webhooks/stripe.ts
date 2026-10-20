import type { Request, Response } from "express";
import Stripe from "stripe";
import { db } from "../db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/** POST /webhooks/stripe */
export async function stripeWebhook(req: Request, res: Response) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"]!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.warn("stripe webhook: signature verification failed", (err as Error).message);
    return res.status(400).send("Webhook Error: invalid signature");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email ?? session.customer_email ?? null;
    if (email) {
      await db.users.markPaid(email, session.id);
      await reportToTrakyo(session, email);
    }
  }
  res.json({ received: true });
}

async function reportToTrakyo(session: Stripe.Checkout.Session, email: string) {
  await fetch("https://api.trakyo.io/v1/conversions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TRAKYO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identity: { email },
      event: {
        kind: "purchase",
        value: (session.amount_total ?? 0) / 100,
        currency: session.currency,
        payment_processor: "stripe",
      },
    }),
  });
}
