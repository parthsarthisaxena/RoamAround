/* RoamAround — AI Trip Treasurer: Razorpay TEST mode, mock fallback when keys absent */
"use strict";
const crypto = require("crypto");
let _db = null, _push = null;
const RZP_KEY = process.env.RAZORPAY_KEY_ID || "";
const RZP_SEC = process.env.RAZORPAY_KEY_SECRET || "";
const WH_SEC  = process.env.RAZORPAY_WEBHOOK_SECRET || RZP_SEC || "roamcircle-mock-webhook-dev";
const AMOUNT = 1000, MAX_NUDGES = 2, NUDGE_GAP_H = 12, EXPIRE_H = 48;
const enabled = () => !!(RZP_KEY && RZP_SEC && _db);   // real Razorpay mode
function bind(db, push) { _db = db; _push = push; }

async function rzp(path, body) {
  const r = await fetch("https://api.razorpay.com/v1/" + path, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${RZP_KEY}:${RZP_SEC}`).toString("base64"), "Content-Type": "application/json" },
    body: JSON.stringify(body) });
  if (!r.ok) throw new Error("rzp_" + r.status);
  return r.json();
}
async function postSystem(threadId, meta, text, peerIds) {
  const msg = { threadId, from: "bot_treasurer", fromName: "Trip Treasurer", text, type: "deposit", meta, createdAt: new Date() };
  await _db.collection("messages").insertOne(msg);
  let ids = peerIds;
  if (!ids) {
    const d = await _db.collection("deposits").findOne({ threadId });
    ids = d ? Object.keys(d.links || {}) : [];
  }
  const ev = { type: "new_message", threadId, from: "bot_treasurer", fromName: "Trip Treasurer", text, msgType: "deposit", meta, ts: msg.createdAt.toISOString() };
  for (const id of ids) if (id) _push(id, ev);
}
async function tryInit(myId, requesterId) {
  if (!_db) return;
  const threadId = [myId, requesterId].sort().join("_");
  if (await _db.collection("deposits").findOne({ threadId })) return;
  const links = {};
  for (const uid of [myId, requesterId]) {
    let url;
    if (enabled()) {
      const pl = await rzp("payment_links", { amount: AMOUNT * 100, currency: "INR",
        description: "RoamAround good-faith trip deposit", reference_id: `${threadId}_${uid}` });
      url = pl.short_url;
    } else {
      url = `/mock-pay.html?ref=${threadId}_${uid}`;   // mock mode — no Razorpay account needed
    }
    links[uid] = { url, status: "created" };
    await postSystem(threadId, { title: "Good-faith deposit", amount: AMOUNT, link: url,
      sub: enabled() ? "Crew locks in when both riders secure their spot."
                     : "TEST CHECKOUT — crew locks in when both riders pay." },
      "💳 Trip deposit created — crew locks in when both riders pay.",
      [myId, requesterId]);
  }
  await _db.collection("deposits").insertOne({ threadId, amount: AMOUNT, links, status: "pending",
    nudges: 0, stopped: false, mode: enabled() ? "razorpay" : "mock",
    createdAt: new Date(), audit: [{ ts: new Date(), event: "pool_created" }] });
}
function hmacEqual(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const sig = String(signature);
  if (!/^[0-9a-f]+$/i.test(sig) || sig.length % 2 !== 0) return false;
  try {
    const expect = crypto.createHmac("sha256", secret).update(rawBody).digest();
    const given  = Buffer.from(sig, "hex");
    if (given.length !== expect.length) return false;
    return crypto.timingSafeEqual(given, expect);
  } catch { return false; }
}

function splitReference(referenceId) {
  const ref = String(referenceId || "");
  const i = ref.lastIndexOf("_");
  if (i < 1) return { threadId: "", uid: "" };
  return { threadId: ref.slice(0, i), uid: ref.slice(i + 1) };
}

async function webhook(rawBody, signature) {
  if (!hmacEqual(rawBody, signature, WH_SEC)) return { ok: false };
  let ev;
  try { ev = JSON.parse(rawBody); }
  catch { return { ok: false }; }
  if (ev.event !== "payment_link.paid") return { ok: true };
  const { threadId, uid } = splitReference(ev.payload?.payment_link?.entity?.reference_id);
  if (!threadId || !uid) return { ok: true };
  const existing = await _db.collection("deposits").findOne({ threadId });
  if (!existing?.links?.[uid]) return { ok: true };
  if (existing.status !== "pending") return { ok: true };
  if (existing.links[uid].status === "paid") return { ok: true };
  if (existing.links[uid].status !== "created") return { ok: true };
  const res = await _db.collection("deposits").findOneAndUpdate(
    { threadId, status: "pending", [`links.${uid}.status`]: "created" },
    { $set: { [`links.${uid}.status`]: "paid" }, $push: { audit: { ts: new Date(), event: "paid_" + uid } } },
    { returnDocument: "after" });
  const d = res && ("value" in res ? res.value : res);
  if (d && Object.values(d.links).every(l => l.status === "paid")) {
    await _db.collection("deposits").updateOne({ threadId },
      { $set: { status: "locked" }, $push: { audit: { ts: new Date(), event: "crew_locked" } } });
 await postSystem(threadId, { title: "Deposits secured 🎉", amount: AMOUNT, status: "paid",
  sub: "You both opted in. Have a great ride!" }, "🎉 Both deposits secured — crew fully backed!");
  }
  return { ok: true };
}
// Mock checkout self-signs a webhook — ONLY when Razorpay keys are absent
async function mockPay(referenceId, userId) {
  if (enabled() || !_db) return { ok: false };
  const ref = String(referenceId || "");
  const { threadId, uid } = splitReference(ref);
  if (!userId || uid !== userId || !threadId) return { ok: false };
  const d = await _db.collection("deposits").findOne({ threadId });
  if (!d?.links?.[userId] || d.links[userId].status !== "created") return { ok: false };
  const body = JSON.stringify({ event: "payment_link.paid",
    payload: { payment_link: { entity: { reference_id: ref } } } });
  const sig = crypto.createHmac("sha256", WH_SEC).update(body).digest("hex");
  return webhook(body, sig);
}
async function skipDeposit(threadId, userId) {
  if (!_db) return { ok: false };
  const existing = await _db.collection("deposits").findOne({ threadId, status: "pending" });
  if (!existing?.links?.[userId]) return { ok: false };
  const res = await _db.collection("deposits").findOneAndUpdate(
    { threadId, status: "pending" },
    { $set: { [`links.${userId}.status`]: "skipped" },
      $push: { audit: { ts: new Date(), event: "skipped_" + userId } } },
    { returnDocument: "after" }
  );
  const d = res && ("value" in res ? res.value : res);
  if (!d) return { ok: false };
  const open    = Object.values(d.links).some(l => l.status === "created");
  const allPaid = Object.values(d.links).every(l => l.status === "paid");
  if (!open && !allPaid) {
    await _db.collection("deposits").updateOne({ threadId },
      { $set: { status: "closed" }, $push: { audit: { ts: new Date(), event: "closed_optional" } } });
  }
  return { ok: true };
}
async function tick() { // bounded recovery: ≤2 nudges, 12h apart, expire 48h
  if (!_db) return;
  for (const d of await _db.collection("deposits").find({ status: "pending", stopped: false }).toArray()) {
    const ageH = (Date.now() - new Date(d.createdAt)) / 36e5;
    if (ageH > EXPIRE_H) { await _db.collection("deposits").updateOne({ threadId: d.threadId },
      { $set: { status: "expired" }, $push: { audit: { ts: new Date(), event: "expired" } } }); continue; }
      const unpaid = Object.entries(d.links).find(([, l]) => l.status === "created");
      if (unpaid && d.nudges < MAX_NUDGES && ageH > NUDGE_GAP_H * (d.nudges + 1)) {
      await _db.collection("deposits").updateOne({ threadId: d.threadId },
        { $set: { nudges: d.nudges + 1 }, $push: { audit: { ts: new Date(), event: "nudge_" + (d.nudges + 1) } } });
      await postSystem(d.threadId, { title: "Friendly nudge", amount: AMOUNT, link: unpaid[1].url,
        sub: "Your deposit is still open — secure it or skip anytime." }, "⏳ One deposit still pending — nudge " + (d.nudges + 1) + "/" + MAX_NUDGES);
    }
  }
}
async function applyStopRule(threadId, text) {
  if (!/\bstop\b/i.test(text || "")) return;
  await _db?.collection("deposits").updateOne({ threadId, status: "pending" },
    { $set: { stopped: true }, $push: { audit: { ts: new Date(), event: "user_stop_respected" } } });
}
module.exports = { bind, enabled, tryInit, webhook, mockPay, skipDeposit, tick, applyStopRule };
