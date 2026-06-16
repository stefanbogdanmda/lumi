// stripe-webhook.js — Lumi Pro license issuance on payment.
//
// Copy-paste-ready Vercel serverless function (also works on Next.js API routes;
// Express/Cloudflare notes at the bottom). On a successful Stripe payment it
// signs a Lumi Pro license key with your Ed25519 PRIVATE key (the same format
// core/src/license.ts verifies) and emails it to the customer.
//
// ── Setup (see docs/business/billing-integration.md) ─────────────────────────
//   1. `npm i stripe` in this folder (Resend is called over fetch — no SDK).
//   2. Set the env vars in .env.example on your host (Vercel → Project → Settings → Env).
//   3. Stripe Dashboard → Developers → Webhooks → add endpoint → this URL,
//      events: checkout.session.completed, invoice.paid, customer.subscription.deleted.
//   4. Paste the signing endpoint's "Signing secret" into STRIPE_WEBHOOK_SECRET.
//
// The keys this produces are accepted by `lumi license <key>` once you've embedded
// the matching PUBLIC key in core/src/license.ts (LUMI_PUBLIC_KEY).

import Stripe from "stripe";
import { signLicense } from "./sign.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Vercel/Next: we need the RAW body for Stripe signature verification.
export const config = { api: { bodyParser: false } };

// ── license signing — reads the private key from env, delegates to ./sign.mjs ──
/** Sign a Pro key for `email` (optionally expiring at ISO `expires`). */
function issueKey(email, expires) {
  const privateKeyPem = process.env.LUMI_LICENSE_PRIVATE_KEY; // full PEM, incl. BEGIN/END lines
  if (!privateKeyPem) throw new Error("LUMI_LICENSE_PRIVATE_KEY is not set");
  return signLicense(privateKeyPem, email, expires);
}

// ── email delivery (Resend; swap for Postmark/SES if you prefer) ─────────────
async function emailLicense(email, key) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.LUMI_FROM_EMAIL || "Lumi <hello@lumi.dev>",
      to: email,
      subject: "Your Lumi Pro license 🔓",
      text:
        `Thanks for upgrading to Lumi Pro!\n\n` +
        `Activate it by running this in your terminal:\n\n` +
        `    lumi license ${key}\n\n` +
        `That unlocks certificates, all learning paths, project-wide security scans,\n` +
        `streak freezes, and the rich weekly digest. Happy building — Lumi`,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** For a subscription, look up its current period end → license expiry (paid-through). */
async function subscriptionExpiry(subscriptionId) {
  if (!subscriptionId) return undefined;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : undefined;
}

// ── the webhook ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  // 1) Verify the event really came from Stripe (raw body required).
  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  try {
    switch (event.type) {
      // New purchase (one-time or first subscription invoice via Checkout).
      case "checkout.session.completed": {
        const s = event.data.object;
        const email = s.customer_details?.email || s.customer_email;
        if (email) {
          const expires = await subscriptionExpiry(s.subscription); // undefined for one-time = perpetual
          await emailLicense(email, issueKey(email, expires));
        }
        break;
      }
      // Subscription renewal — re-issue a key with the new paid-through date.
      case "invoice.paid": {
        const inv = event.data.object;
        const email = inv.customer_email;
        if (email && inv.subscription) {
          const expires = await subscriptionExpiry(inv.subscription);
          await emailLicense(email, issueKey(email, expires));
        }
        break;
      }
      // Cancellation: nothing to do — the last key simply expires at paid-through.
      case "customer.subscription.deleted":
        break;
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    // Returning 500 makes Stripe retry — good for transient email/signing failures.
    console.error("Lumi webhook handler error:", err);
    return res.status(500).send("handler error");
  }
}

// ── Express variant (if not on Vercel) ───────────────────────────────────────
// app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
//   let event;
//   try { event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET); }
//   catch (e) { return res.status(400).send(`bad sig: ${e.message}`); }
//   // ...same switch as above (req.body is already the raw Buffer here)...
// });
