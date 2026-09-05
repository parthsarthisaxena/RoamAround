/* RoamAround — AI vibe matcher: schema-enforced Gemini + deterministic fallback */
"use strict";
const { scoreCompatibility } = require("./scoring.js");
const { ObjectId } = require("mongodb");
function geminiKey()   { return process.env.GEMINI_API_KEY || ""; }
function geminiModel() { return process.env.GEMINI_MODEL  || "gemini-2.0-flash"; }

function vibeSchema() {
  return { type: "object",
    properties: {
      vibe_score: { type: "number" },
      match:      { type: "boolean" },
      reasoning:  { type: "string" }
    },
    required: ["vibe_score", "match", "reasoning"] };
}
function describe(r) {
  return [
    r.trip ? `Trip: ${r.trip.from || "?"} → ${r.trip.to || "?"}, pace=${r.trip.pace || "moderate"}, budget=${r.trip.budget || "mid"}, ${r.trip.startDate || ""} to ${r.trip.endDate || ""}` : "",
    r.trip?.habits ? `Habits: ${r.trip.habits}` : "",
    r.bio ? `About: ${r.bio}` : "",
    r.lookingFor ? `Looking for: ${r.lookingFor}` : "",
    r.rating?.average != null ? `Rating ${r.rating.average}/5 (${r.rating.count} reviews). Riders say: ${(r.rating.snippets || []).join(" | ")}` : ""
  ].filter(Boolean).join("\n");
}
async function llmVibe(me, cand) {
  const GEMINI_KEY = geminiKey();
  const GEMINI_MODEL = geminiModel();
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text:
          `You are a matchmaker for motorcycle trip companions on RoamAround.\nRIDER A:\n${describe(me)}\n\nRIDER B:\n${describe(cand)}\n\nJudge compatibility using these rules IN ORDER:\n1. FAST DEMANDS ARE STRICT: if either rider's "Looking for" asks for fast pace ("fast-paced riders", "fast riders", "350+ km days", "self-reliant fast riders"), HARD REJECT any moderate or relaxed rider — a toolkit or gear does not compensate for pace.\n2. MODERATE DEMANDS ARE SOFT: a "moderate-paced riders" demand accepts a relaxed rider WITH proven long-distance experience (e.g. completed Spiti); HARD REJECT a relaxed rider with no prior long rides.\n3. HARD REJECT hard-constraint clashes: "no camping" vs a camper; smoker vs non-smoker.\n4. HARD REJECT unsafe experience gap: a rider with NO prior long-distance rides paired with someone riding 350+ km days.\n5. Otherwise ACCEPT: pace one step apart is fine — match=true, lower vibe_score, mention the gap in reasoning.\n6. Shared habits (camping, early starts, non-smoker, photography) raise vibe_score.\nRespond with vibe_score 0..1, match bool, reasoning = 1-2 sentences the rider will read (specific, no fluff).` }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: vibeSchema() }
      })
    });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error("gemini_" + resp.status + ": " + t.slice(0, 140));
  }
  const raw = (await resp.json()).candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("empty_response");
  const v = JSON.parse(raw);
  if (typeof v.vibe_score !== "number" || v.vibe_score < 0 || v.vibe_score > 1 ||
      typeof v.reasoning !== "string" || v.reasoning.length < 10) throw new Error("bad_schema");
  return v;
}
async function rankWithAI(db, myUserId, candidateIds, ratingFn) {
  const myTrip = await db.collection("trips").findOne({ userId: myUserId });
  let myUser = null;
  try { myUser = await db.collection("users").findOne({ _id: new ObjectId(myUserId) }); } catch {}
  const me = { trip: myTrip || {}, bio: myUser?.bio, lookingFor: myUser?.lookingFor };
  const out = [];
  for (const cid of candidateIds.slice(0, 5)) {
    const t = await db.collection("trips").findOne({ userId: cid });
    let u = null; try { u = await db.collection("users").findOne({ _id: new ObjectId(cid) }); } catch {}
    const r = await ratingFn(cid).catch(() => ({ average: null, count: 0, reviews: [] }));
    const cand = { trip: t || {}, bio: u?.bio, lookingFor: u?.lookingFor,
      rating: { average: r.average, count: r.count, snippets: (r.reviews || []).slice(0, 2).map(x => x.comment) } };
    let d = { tier: "llm", model: geminiModel() };
    try {
      const v = await llmVibe(me, cand);
      d.score = v.vibe_score; d.reasoning = v.reasoning;
    } catch (e) {
      d = { tier: "fallback", score: scoreCompatibility(myTrip || {}, t || {}) / 100,
            reasoning: "AI unavailable — deterministic score used", aiError: e.message };
    }
    await db.collection("match_decisions").insertOne({ myId: myUserId, candId: cid, ...d, ts: new Date() });
    out.push({ userId: cid, ...d });
  }
  return out;
}
module.exports = { llmVibe, rankWithAI };