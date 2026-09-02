"use strict";
// Usage: node -r dotenv/config tools/simulate_webhook.js <userIdA> <userIdB>
const crypto = require("crypto");
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
if (!SECRET) { console.error("Set RAZORPAY_KEY_SECRET in .env first."); process.exit(1); }
const [,, a, b] = process.argv;
if (!a || !b) { console.error("Usage: node -r dotenv/config tools/simulate_webhook.js <userIdA> <userIdB>"); process.exit(1); }
const threadId = [a, b].sort().join("_");
(async () => {
  for (const uid of [a, b]) {
    const body = JSON.stringify({
      event: "payment_link.paid",
      payload: { payment_link: { entity: { reference_id: `${threadId}_${uid}` } } }
    });
    const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
    const res = await fetch("http://localhost:3000/api/razorpay/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-razorpay-signature": sig },
      body
    });
    console.log(uid.slice(0, 6), "→", res.status, await res.text());
  }
})();