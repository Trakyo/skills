import express from "express";
import cookieParser from "cookie-parser";
import { signup } from "./routes/signup";
import { stripeWebhook } from "./webhooks/stripe";

const app = express();
app.use(cookieParser());
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhook);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.post("/signup", signup);

app.listen(3000);
