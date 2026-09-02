/* RoamCircle — deterministic compatibility scorer (extracted from server.js) */
"use strict";
const PACE_RANK   = { relaxed: 0, moderate: 1, fast: 2 };
const BUDGET_RANK = { budget: 0, mid: 1, comfort: 2 };

function extractHabitWords(habits) {
  const stop = new Set(["and","the","a","i","to","in","with","for","is","am","are","im","its","of","on","at"]);
  return new Set(
    habits.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w))
  );
}

function scoreCompatibility(myTrip, theirTrip) {
  let score = 0;
  try {
    const ms = new Date(myTrip.startDate), me = new Date(myTrip.endDate);
    const ts = new Date(theirTrip.startDate), te = new Date(theirTrip.endDate);
    if (!isNaN(ms) && !isNaN(me) && !isNaN(ts) && !isNaN(te)) {
      const overlapMs   = Math.min(me,te) - Math.max(ms,ts);
      const overlapDays = overlapMs / 86_400_000;
      if (overlapDays >= 0) {
        score += Math.min(30, Math.round((overlapDays / Math.max(1,(me-ms)/86_400_000)) * 30));
      } else {
        const gapDays = Math.abs(overlapDays);
        if      (gapDays <= 3)  score += 15;
        else if (gapDays <= 7)  score += 8;
        else if (gapDays <= 14) score += 3;
      }
    }
  } catch {}
  const pd = Math.abs((PACE_RANK[myTrip.pace]??1) - (PACE_RANK[theirTrip.pace]??1));
  score += pd===0 ? 25 : pd===1 ? 12 : 0;
  const bd = Math.abs((BUDGET_RANK[myTrip.budget]??1) - (BUDGET_RANK[theirTrip.budget]??1));
  score += bd===0 ? 25 : bd===1 ? 12 : 0;
  const myW = extractHabitWords(myTrip.habits||""), thW = extractHabitWords(theirTrip.habits||"");
  if (myW.size > 0 && thW.size > 0) {
    const shared = [...myW].filter(w=>thW.has(w)).length;
    score += Math.round((shared / new Set([...myW,...thW]).size) * 15);
  }
  const myLooking  = extractHabitWords(myTrip.lookingFor  || "");
  const theirHabits= extractHabitWords(theirTrip.habits   || "");
  const thLooking  = extractHabitWords(theirTrip.lookingFor|| "");
  const myHabits   = extractHabitWords(myTrip.habits      || "");
  let lfScore = 0;
  if (myLooking.size > 0 && theirHabits.size > 0) {
    const match = [...myLooking].filter(w => theirHabits.has(w)).length;
    lfScore += Math.round((match / myLooking.size) * 3);
  }
  if (thLooking.size > 0 && myHabits.size > 0) {
    const match = [...thLooking].filter(w => myHabits.has(w)).length;
    lfScore += Math.round((match / thLooking.size) * 2);
  }
  score += Math.min(5, lfScore);
  return Math.min(100, score);
}

module.exports = { scoreCompatibility };