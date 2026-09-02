"use strict";
const fs = require("fs"), path = require("path");
const { scoreCompatibility } = require("../scoring.js");
const { llmVibe } = require("../ai_matcher.js");

const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, "profiles.json"), "utf8"));
const pairs    = JSON.parse(fs.readFileSync(path.join(__dirname, "pairs.json"), "utf8"));
const byId = Object.fromEntries(profiles.map(p => [p.id, p]));
const DET_T = 60;
const PROMPT_VERSION = "v4";            // bump when you edit the prompt → old cache ignored
const CACHE_FILE = path.join(__dirname, "ai_cache.json");
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch {}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function callWithBackoff(fn, tries = 3) {
  let wait = 20_000;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      if (!String(e.message).includes("429") || i === tries - 1) throw e;
      console.error("   [429] rate-limited — backing off " + (wait / 1000) + "s…");
      await sleep(wait); wait *= 2;
    }
  }
}
function metrics(pred, label) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  pred.forEach((p, i) => { p === 1 && label[i] === 1 ? tp++ : p === 1 ? fp++ : label[i] === 1 ? fn++ : tn++; });
  const precision = tp / Math.max(1, tp + fp), recall = tp / Math.max(1, tp + fn);
  return { precision, recall, f1: 2 * precision * recall / Math.max(1e-9, precision + recall) };
}
(async () => {
  const labels  = pairs.map(p => p.label);
  const detPred = pairs.map(p => scoreCompatibility(byId[p.a].trip, byId[p.b].trip) >= DET_T ? 1 : 0);
  const aiPred  = [];
  console.log("pair".padEnd(16), "label  det  ai");
  for (let i = 0; i < pairs.length; i++) {
    const p   = pairs[i];
    const key = PROMPT_VERSION + ":" + p.a + "-" + p.b;
    let ai;
    if (cache[key] != null) {
      ai = cache[key];
      console.log((p.a + "-" + p.b).padEnd(16), String(p.label).padEnd(6), String(detPred[i]).padEnd(4), ai, " (cached)");
    } else {
      await sleep(4500);                       // ≈10 req/min — under free-tier RPM
      try {
        const v = await callWithBackoff(() => llmVibe(byId[p.a], byId[p.b]));
        ai = v.match ? 1 : 0;
        console.log("   └─ AI:", v.reasoning);
        cache[key] = ai;                                   // cache ONLY real AI answers
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      } catch (e) {
        ai = detPred[i];
        console.error("[ai fallback]", p.a + "-" + p.b, e.message);
        // do not cache fallbacks — a later run with a working key must re-query
      }
    }
    aiPred.push(ai);
  }
  const det = metrics(detPred, labels), ai = metrics(aiPred, labels);
  console.log("\nDET  P=" + det.precision.toFixed(2), "R=" + det.recall.toFixed(2), "F1=" + det.f1.toFixed(2));
  console.log("AI   P=" + ai.precision.toFixed(2),  "R=" + ai.recall.toFixed(2),  "F1=" + ai.f1.toFixed(2));
  fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify({ promptVersion: PROMPT_VERSION, det, ai }, null, 2));
})();