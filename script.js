/* ─── RoamCircle — AI route planner ─────────────────────────
 * Handles the dedicated AI planner form (#planner-form)
 * Trip publishing (#trip-form) is handled by chat.js
 ─────────────────────────────────────────────────────────── */

// ── Element refs ─────────────────────────────────────────────
const plannerForm   = document.getElementById("planner-form");
const plannerTitle  = document.getElementById("planner-title");
const plannerSummary= document.getElementById("planner-summary");
const plannerDays   = document.getElementById("planner-days");
const plannerStatus = document.getElementById("planner-status");
const plannerSource = document.getElementById("planner-source");
const plannerBtn    = document.getElementById("planner-submit-btn");

// ── Demo fallback templates (used when Gemini is unavailable) ─
const demoTemplates = {
  motorcycle: [
    ["Leave early, reach first night stop before dark",
     "Cold engine start, fuel up, target 250 km before peak heat. Settle at a dhaba town."],
    ["First mountain roads — pace through the ghats",
     "Winding roads, scenic stops every 60–80 km. Let the bike breathe on climbs."],
    ["Fuel and food checkpoint day",
     "Long flat stretch — eat well, check tyres and chain, refuel twice. Easy evening."],
    ["High altitude gateway — acclimatise",
     "Short 120 km day. Check bike fluids, altitude readiness, and rest early."],
    ["The pass day — most challenging and rewarding",
     "4am start. Cold, thin air, loose gravel. Slow and steady. Celebrate at the top."],
    ["Descent into the valley — the payoff",
     "Wide open views, smoother road. Let the bike roll. Arrive with time to explore."],
    ["Final stretch and destination arrival",
     "Easy mileage. Photograph everything. Park the bike and breathe it in."]
  ],
  roadtrip: [
    ["Load up and hit the highway early", "Motorway miles, one fuel stop, arrive by evening."],
    ["Scenic detour day", "Leave the highway. Find the mountain or coastal road."],
    ["Rest and explore a town", "Short drive — walk, eat well, sleep early."],
    ["Long haul through the interior", "Flat and fast. Good snacks, one proper lunch stop."],
    ["Mountain or border crossing", "Slower but worth it. Camp or guesthouse en route."],
    ["Almost there", "Final overnight before the destination."],
    ["Arrival day", "Short drive, big arrival. Explore on foot."]
  ],
  cycling: [
    ["Warm up day — short and scenic", "Under 60 km. Get the legs going. Check fit and gear."],
    ["First big climb", "Pace yourself. Eat before you're hungry, drink before you're thirsty."],
    ["Valley day — fast and flat", "Make up distance. Tailwind if lucky. Long lunch stop."],
    ["Rest and recover", "Under 40 km. Stretch, refuel, enjoy being somewhere."],
    ["The hardest day — multiple passes", "Early start. Take it section by section."],
    ["Descent reward day", "The legs get a break. Long winding descent. Soak it in."],
    ["Final ride into the destination", "Ceremonial last stretch. Arrive proud."]
  ],
  hiking: [
    ["Trailhead and first camp", "Light first day. Set up base, check gear, sleep early."],
    ["First full trail day", "Steady elevation. Pace conservatively. Hydrate constantly."],
    ["Remote section — no resupply", "Carry full water. Long km. Best views of the trip."],
    ["Rest camp day", "Short hike to viewpoint then rest. Feet will thank you."],
    ["Summit or high point", "Alpine start. Cold and technical. Most memorable day."],
    ["Descent begins", "Trekking poles essential. Slower than the ascent."],
    ["Trail out and celebrate", "Final km then find a good meal and a shower."]
  ],
  backpacking: [
    ["Arrive and find your bearings", "Hostel or guesthouse, orientation walk, easy first dinner."],
    ["Explore the main area", "Landmarks, street food, local market, meet other travelers."],
    ["Day trip from the base", "Nearby village, coast, or hill — return by evening."],
    ["Slow travel day", "Move to the next stop. Long bus or short flight."],
    ["Best day — save it for now", "The thing you most wanted to do. Full day commitment."],
    ["Wind down and pack", "Light plans, good meal, sort the bag for departure."],
    ["Departure", "One final coffee stop before leaving."]
  ]
};

function titleCase(v) {
  return String(v).split(" ").filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// ── Build offline demo plan ───────────────────────────────────
function buildDemo(input) {
  const dest  = titleCase(input.destination || "Your Destination");
  const from  = input.source ? titleCase(input.source) + " → " : "";
  const type  = input.tripType || "motorcycle";
  const tmpl  = demoTemplates[type] || demoTemplates.motorcycle;
  const count = Math.min(Number(input.days) || 5, 7);
  const label = { motorcycle:"ride", cycling:"cycle", hiking:"trek",
                  roadtrip:"trip", backpacking:"trip" }[type] || "trip";

  return {
    title:   `${count}-day ${from}${dest} ${label}`,
    summary: `${titleCase(input.budget || "mid-range")} · ${from}${dest} · ${count} days`,
    days: tmpl.slice(0, count).map((item, i) => ({
      day:         i + 1,
      title:       item[0],
      description: item[1]
      // Rich fields (rideCondition, hiddenGem etc.) only come from Gemini
    }))
  };
}

// ── Render plan into the UI ───────────────────────────────────
function renderPlan(plan) {
  if (!plannerDays) return;
  if (plannerTitle)   plannerTitle.textContent   = plan.title;
  if (plannerSummary) plannerSummary.textContent = plan.summary;

  // Show insider tip if present
  const tipEl = document.getElementById("planner-insider-tip");
  if (tipEl) {
    if (plan.insiderTip) {
      tipEl.textContent = "💡 " + plan.insiderTip;
      tipEl.style.display = "block";
    } else {
      tipEl.style.display = "none";
    }
  }

  plannerDays.innerHTML = plan.days.map(d => {
    // Detect if this is a rich Gemini card or a simple demo card
    const isRich = d.from || d.rideCondition || d.hiddenGem;

    if (!isRich) {
      // Simple demo fallback
      return `
        <article class="day-card">
          <div class="dc-header">
            <span class="dc-day">Day ${d.day}</span>
            <strong>${escHtml(d.title)}</strong>
          </div>
          <p>${escHtml(d.description || "")}</p>
        </article>`;
    }

    return `
      <article class="day-card rich-day-card">
        <!-- Day header -->
        <div class="dc-header">
          <span class="dc-day">Day ${d.day}</span>
          <div class="dc-route-line">
            <span class="dc-from">${escHtml(d.from || "")}</span>
            ${d.to ? `
              <svg width="20" height="8" viewBox="0 0 20 8">
                <path d="M0 4h14M10 1l4 3-4 3" stroke="#1DB954" stroke-width="1.5"
                      fill="none" stroke-linecap="round"/>
              </svg>
              <span class="dc-to">${escHtml(d.to)}</span>` : ""}
          </div>
          ${d.distance ? `<span class="dc-distance">📍 ${escHtml(d.distance)}</span>` : ""}
        </div>

        <div class="dc-title">${escHtml(d.title)}</div>

        <!-- Info grid -->
        <div class="dc-grid">
          ${d.rideCondition ? `
            <div class="dc-item">
              <div class="dc-label">🛣️ Road conditions</div>
              <div class="dc-val">${escHtml(d.rideCondition)}</div>
            </div>` : ""}

          ${d.fuelStop ? `
            <div class="dc-item">
              <div class="dc-label">⛽ Last fuel point</div>
              <div class="dc-val">${escHtml(d.fuelStop)}</div>
            </div>` : ""}

          ${d.sleepAt ? `
            <div class="dc-item">
              <div class="dc-label">🛏️ Sleep at${d.sleepType ? " · " + d.sleepType : ""}</div>
              <div class="dc-val">${escHtml(d.sleepAt)}</div>
            </div>` : ""}

          ${d.localFood ? `
            <div class="dc-item">
              <div class="dc-label">🍛 Local food</div>
              <div class="dc-val">${escHtml(d.localFood)}</div>
            </div>` : ""}

          ${d.permits ? `
            <div class="dc-item">
              <div class="dc-label">📋 Permits / checkpoints</div>
              <div class="dc-val">${escHtml(d.permits)}</div>
            </div>` : ""}

          ${d.altRoute ? `
            <div class="dc-item">
              <div class="dc-label">🔀 Alt route</div>
              <div class="dc-val">${escHtml(d.altRoute)}</div>
            </div>` : ""}
        </div>

        <!-- Highlighted callouts -->
        ${d.hiddenGem ? `
          <div class="dc-callout gem">
            <span class="dc-callout-icon">💎</span>
            <div>
              <div class="dc-callout-label">Hidden gem</div>
              <div class="dc-callout-text">${escHtml(d.hiddenGem)}</div>
            </div>
          </div>` : ""}

        ${d.watchOut ? `
          <div class="dc-callout warn">
            <span class="dc-callout-icon">⚠️</span>
            <div>
              <div class="dc-callout-label">Watch out</div>
              <div class="dc-callout-text">${escHtml(d.watchOut)}</div>
            </div>
          </div>` : ""}
      </article>`;
  }).join("");

  // Scroll result into view smoothly
  document.getElementById("ai-planner")
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Call Gemini via server ────────────────────────────────────
async function fetchGeminiPlan(input) {
  const res = await fetch("/api/itinerary", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(input)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

// ── Sync planner inputs from published trip form ──────────────
function syncFromTripForm() {
  const map = {
    "pl-source":      "source",
    "pl-destination": "destination",
    "pl-type":        "trip-type",
    "pl-vehicle":     "vehicle",
    "pl-habits":      "habits",
    "pl-budget":      "budget"
  };
  for (const [plannerId, tripId] of Object.entries(map)) {
    const tripEl    = document.getElementById(tripId);
    const plannerEl = document.getElementById(plannerId);
    if (tripEl && plannerEl && tripEl.value && !plannerEl.value) {
      plannerEl.value = tripEl.value;
    }
  }
}

// ── Wire planner form ─────────────────────────────────────────
if (plannerForm) {
  // Pre-fill from trip form values on load
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(syncFromTripForm, 800); // after chat.js restores trip form
  });

  plannerForm.addEventListener("submit", async e => {
    e.preventDefault();

    const fd    = new FormData(plannerForm);
    const input = {
      source:      String(fd.get("source")      || "").trim(),
      destination: String(fd.get("destination") || "").trim(),
      days:        Number(fd.get("days")        || 5),
      budget:      String(fd.get("budget")      || "mid"),
      tripType:    String(fd.get("trip-type")   || "motorcycle"),
      vehicle:     String(fd.get("vehicle")     || "").trim(),
      habits:      String(fd.get("habits")      || "").trim()
    };

    if (!input.destination) {
      if (plannerStatus) plannerStatus.textContent = "Please enter a destination.";
      return;
    }

    // Loading state
    if (plannerBtn)    { plannerBtn.textContent = "Generating…"; plannerBtn.disabled = true; }
    if (plannerTitle)  plannerTitle.textContent   = "Planning your route…";
    if (plannerSummary)plannerSummary.textContent = "Gemini is building a personalised day-by-day plan.";
    if (plannerDays)   plannerDays.innerHTML      = '<div class="planner-loading"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    if (plannerStatus) plannerStatus.textContent  = "";
    if (plannerSource) plannerSource.textContent  = "Gemini";

    try {
      const plan = await fetchGeminiPlan(input);
      renderPlan(plan);
      if (plannerSource) plannerSource.textContent = "Gemini ✓";
      if (plannerStatus) plannerStatus.textContent = "✓ Generated with Gemini AI.";
    } catch(err) {
      console.error("[planner]", err.message);
      renderPlan(buildDemo(input));
      if (plannerSource) plannerSource.textContent = "Demo";
      if (plannerStatus) {
        const isNoKey = err.message.includes("GEMINI_API_KEY") || err.message.includes("not configured");
        plannerStatus.textContent = isNoKey
          ? "⚠ Gemini key not set — showing demo plan. Add GEMINI_API_KEY to enable AI."
          : `⚠ Gemini unavailable — showing demo plan. (${err.message})`;
      }
    } finally {
      if (plannerBtn) { plannerBtn.textContent = "✨ Generate AI route plan"; plannerBtn.disabled = false; }
    }
  });
}
