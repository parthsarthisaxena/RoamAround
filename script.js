/* ─── RoamCircle — AI planner + trip form ─────────────────── */

// ── AI planner (if planner elements present on page) ────────
const plannerDays    = document.querySelector("#planner-days");
const plannerTitle   = document.querySelector("#planner-title");
const plannerSummary = document.querySelector("#planner-summary");
const plannerStatus  = document.querySelector("#planner-status");
const plannerSource  = document.querySelector("#planner-source");

const demoTemplates = {
  motorcycle: [
    ["Leave early, reach first night stop before dark",        "Cold engine start, fuel up, target 250 km before peak heat. Settle at a dhaba town."],
    ["First mountain roads — pace through the ghats",          "Winding roads, scenic stops every 60–80 km. Let the bike breathe on climbs."],
    ["Fuel and food checkpoint day",                           "Long flat stretch — eat well, check tyres and chain, refuel twice. Easy evening."],
    ["High altitude gateway — Manali or similar",              "Short 120 km day. Acclimatise. Check bike fluids and altitude readiness."],
    ["The pass day — most challenging and rewarding",          "4am start. Cold, thin air, loose gravel. Slow and steady. Celebrate at the top."],
    ["Descent into the valley — the payoff",                   "Wide open views, smoother road. Let the bike roll. Arrive with time to explore."],
    ["Final stretch and destination arrival",                  "Easy mileage. Photograph everything. Park the bike and breathe it in."]
  ],
  roadtrip: [
    ["Load up and hit the highway early",  "Motorway miles, one fuel stop, arrive by evening."],
    ["Scenic detour day",                  "Leave the highway. Find the mountain or coastal road."],
    ["Rest and explore a town",            "Short drive — walk, eat well, sleep early."],
    ["Long haul through the interior",     "Flat and fast. Good snacks, one proper lunch stop."],
    ["Mountain or border crossing",        "Slower but worth it. Camp or guesthouse en route."],
    ["Almost there",                       "Final overnight before the destination."],
    ["Arrival day",                        "Short drive, big arrival. Explore on foot."]
  ],
  cycling: [
    ["Warm up day — short and scenic",     "Under 60 km. Get the legs going. Check fit and gear."],
    ["First big climb",                    "Pace yourself. Eat before you're hungry, drink before you're thirsty."],
    ["Valley day — fast and flat",         "Make up distance. Tailwind if lucky. Long lunch at a cafe."],
    ["Rest and recover",                   "Under 40 km. Stretch, refuel, and enjoy being somewhere."],
    ["The hardest day — multiple passes",  "Early start. Take it section by section."],
    ["Descent reward day",                 "The legs get a break. Long, winding descent. Soak it in."],
    ["Final ride into the destination",    "Ceremonial last stretch. Arrive proud."]
  ],
  hiking: [
    ["Trailhead and first camp",           "Light first day. Set up base, check gear, sleep early."],
    ["First full trail day",               "Steady elevation. Pace conservatively. Hydrate constantly."],
    ["Remote section — no resupply",       "Carry full water. Long km. Best views of the trip."],
    ["Rest camp day",                      "Short hike to viewpoint then rest. Feet will thank you."],
    ["Summit or high point",               "Alpine start. Cold and technical. Most memorable day."],
    ["Descent begins",                     "Trekking poles essential. Slower than the ascent."],
    ["Trail out and celebrate",            "Final km then find a good meal and a shower."]
  ],
  backpacking: [
    ["Arrive and find your bearings",       "Hostel or guesthouse, orientation walk, easy first dinner."],
    ["Explore the main area",               "Landmarks, street food, local market, meet other travelers."],
    ["Day trip from the base",              "Nearby village, coast, or hill — return by evening."],
    ["Slow travel day",                     "Move to the next stop. Long bus or short flight."],
    ["Best day — save it for now",          "The thing you most wanted to do. Full day commitment."],
    ["Wind down and pack",                  "Light plans, good meal, sort the bag for departure."],
    ["Departure",                           "One final coffee stop before leaving."]
  ],
  balanced: [
    ["Arrive and settle in",               "Short travel, orientation walk, easy first dinner."],
    ["First full exploration day",         "Hit the main highlight, good lunch, afternoon wander."],
    ["Off the beaten path",                "Ask a local. Find something not in the guidebook."],
    ["Rest and recharge",                  "Late breakfast, slow afternoon, early evening out."],
    ["Best day",                           "The thing you most wanted to do. Give it the whole day."],
    ["Wind down",                          "Light plans, great meal, pack for departure."],
    ["Departure day",                      "One final coffee before leaving."]
  ]
};

function titleCase(v) {
  return String(v).split(" ").filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function buildDemo(input) {
  const dest  = titleCase(input.destination || "Your Destination");
  const from  = input.source ? titleCase(input.source) + " → " : "";
  const type  = input.tripType || "balanced";
  const tmpl  = demoTemplates[type] || demoTemplates.balanced;
  const count = Math.min(Number(input.days) || 5, 7);
  const label = type === "motorcycle" ? "ride" : type === "hiking" ? "trek" : type === "cycling" ? "cycle" : "trip";

  return {
    title:   `${count}-day ${from}${dest} ${label}`,
    summary: `${titleCase(input.budget || "mid-range")} · ${from}${dest}`,
    days: tmpl.slice(0, count).map((item, i) => ({
      day: i + 1, title: item[0], description: item[1],
      morning:   "Early start recommended.",
      afternoon: "Adjust based on group energy and conditions.",
      evening:   "Rest, eat, review tomorrow's route."
    }))
  };
}

function renderPlan(plan) {
  if (!plannerDays) return;
  if (plannerTitle)   plannerTitle.textContent   = plan.title;
  if (plannerSummary) plannerSummary.textContent = plan.summary;
  plannerDays.innerHTML = plan.days.map(d => `
    <article class="day-card">
      <span>Day ${d.day}</span>
      <strong>${d.title}</strong>
      <p>${d.description}</p>
      <p><strong>Morning:</strong> ${d.morning}</p>
      <p><strong>Afternoon:</strong> ${d.afternoon}</p>
      <p><strong>Evening:</strong> ${d.evening}</p>
    </article>`).join("");
}

async function fetchAI(input) {
  const res = await fetch("/api/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

// Wire trip form if it exists on this page
const tripForm = document.getElementById("trip-form");
if (tripForm && plannerDays) {
  tripForm.addEventListener("submit", async e => {
    // chat.js handles the publish logic; this only runs AI plan if planner section present
    const fd = new FormData(tripForm);
    const input = {
      source:      String(fd.get("source")      || ""),
      destination: String(fd.get("destination") || ""),
      days:        Number(fd.get("days")        || 5),
      budget:      String(fd.get("budget")      || "mid"),
      tripType:    String(fd.get("trip-type")   || "motorcycle"),
      vehicle:     String(fd.get("vehicle")     || ""),
      habits:      String(fd.get("habits")      || ""),
      notes:       String(fd.get("habits")      || "")
    };

    if (plannerTitle)   plannerTitle.textContent   = "Planning your route…";
    if (plannerSummary) plannerSummary.textContent = "Asking the AI for a day-by-day plan.";
    if (plannerDays)    plannerDays.innerHTML      = "";
    if (plannerStatus)  plannerStatus.textContent  = "";
    if (plannerSource)  plannerSource.textContent  = "AI running";

    try {
      const plan = await fetchAI(input);
      renderPlan(plan);
      if (plannerSource) plannerSource.textContent = "OpenAI";
      if (plannerStatus) plannerStatus.textContent = "✓ Generated with AI.";
    } catch (err) {
      console.error("[planner]", err.message);
      renderPlan(buildDemo(input));
      if (plannerSource) plannerSource.textContent = "Demo";
      if (plannerStatus) plannerStatus.textContent =
        `AI unavailable — showing demo plan. (${err.message})`;
    }
  });
}
