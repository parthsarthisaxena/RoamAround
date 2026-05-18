const plannerForm = document.querySelector("#trip-form");
const plannerTitle = document.querySelector("#planner-title");
const plannerSummary = document.querySelector("#planner-summary");
const plannerDays = document.querySelector("#planner-days");
const plannerStatus = document.querySelector("#planner-status") || document.querySelector("#trip-status");
const plannerSource = document.querySelector("#planner-source");
const signupForm = document.querySelector("#signup-form");

const PROFILE_KEY = "rc_user_profile_v1";

const demoTemplates = {
  motorcycle: [
    ["Leave early, reach the first night stop before dark", "Cold engine start, fuel up, and aim for 250km before heat peaks. Settle into a safe overnight town."],
    ["First mountain roads - pace yourself on the ghats", "Windy roads, scenic stops every 60-80km. Let the bike breathe on long climbs."],
    ["Fuel and food checkpoint day", "Longer flat stretch. Eat well, check tyres and chain, and refuel twice."],
    ["High altitude begins", "Keep this day shorter. Check bike fluids and watch for altitude fatigue."],
    ["The pass day", "Start early. Expect cold, thin air, loose gravel, and slower movement."],
    ["Descent into the valley", "Wide open views and smoother roads. Arrive with time to explore."],
    ["Final stretch and destination arrival", "Easy mileage. Photograph everything, park the bike, and recover."]
  ],
  roadtrip: [
    ["Load the car, hit the highway early", "Motorway miles, one major fuel stop, and a comfortable evening arrival."],
    ["Scenic detour day", "Leave the highway and use the mountain road or coastal route."],
    ["Rest and explore a town", "Short drive day. Walk, eat, and sleep well before the next push."],
    ["Long haul through the interior", "Flat and fast. Podcasts, snacks, and one proper lunch stop."],
    ["Mountain or border crossing day", "Slower going, but worth it for the views."],
    ["Almost there", "Final overnight before the destination."],
    ["Arrival day", "Short drive, big arrival, and explore on foot."]
  ],
  hiking: [
    ["Trailhead day - gear check and first camp", "Light first day. Set up base, check gear, and sleep early."],
    ["First full day on trail", "Steady elevation gain. Pace conservatively and hydrate constantly."],
    ["Remote section", "Carry enough water and snacks. Long kilometres, best views."],
    ["Rest camp day", "Short hike to a viewpoint, then rest."],
    ["Summit or high point attempt", "Alpine start. Cold, technical, and memorable."],
    ["Descent begins", "Trekking poles help. Go slower than the ascent."],
    ["Trail out and celebrate", "Final kilometres, then find a good meal and a shower."]
  ],
  balanced: [
    ["Arrive and settle in", "Short travel, orientation walk, easy first dinner."],
    ["First full exploration day", "Hit the main highlight, find a good lunch spot, and wander in the afternoon."],
    ["Off the beaten path", "Ask a local and find something not in the guidebook."],
    ["Rest and recharge", "Late breakfast, slow afternoon, early evening out."],
    ["Best day", "The thing you most wanted to do. Give it the whole day."],
    ["Wind down day", "Light plans, good meal, and pack for departure."],
    ["Departure day", "One final coffee spot before leaving."]
  ]
};

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (field && value) {
    field.value = value;
  }
}

function applyProfileToDashboard() {
  const profile = loadProfile();
  setFieldValue("source", profile.source);
  setFieldValue("destination", profile.destination);
  setFieldValue("trip-type", profile.tripType);
  setFieldValue("vehicle", profile.vehicle);
  setFieldValue("pace", profile.pace);
  setFieldValue("budget", profile.budget);
  setFieldValue("habits", profile.habits);
  setFieldValue("meetpoints", profile.meetpoints);
}

function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function buildDemo(input) {
  const destination = titleCase(input.destination || "Your Trip");
  const type = input.tripType || "balanced";
  const template = demoTemplates[type] || demoTemplates.balanced;
  const count = Math.min(Number(input.days) || 5, 7);

  return {
    title: `${count}-day ${destination} ${type === "motorcycle" ? "ride" : "trip"}`,
    summary: `${input.budget || "Mid-range"} | ${input.source ? `${input.source} to ${destination}` : destination}`,
    days: template.slice(0, count).map((item, index) => ({
      day: index + 1,
      title: item[0],
      description: item[1],
      morning: "Early start recommended for this leg.",
      afternoon: "Pace yourself and adjust based on group energy.",
      evening: "Rest, eat, and plan tomorrow."
    }))
  };
}

function renderItinerary(itinerary) {
  if (!plannerDays) return;

  if (plannerTitle) plannerTitle.textContent = itinerary.title;
  if (plannerSummary) plannerSummary.textContent = itinerary.summary;

  plannerDays.innerHTML = itinerary.days.map((day) => `
    <article class="day-card">
      <span>Day ${day.day}</span>
      <strong>${day.title}</strong>
      <p>${day.description}</p>
      <p><strong>Morning:</strong> ${day.morning}</p>
      <p><strong>Afternoon:</strong> ${day.afternoon}</p>
      <p><strong>Evening:</strong> ${day.evening}</p>
    </article>
  `).join("");
}

async function fetchAI(input) {
  const response = await fetch("/api/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Server error ${response.status}`);
  }

  return response.json();
}

if (signupForm) {
  signupForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(signupForm);
    saveProfile({
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      source: String(formData.get("source") || ""),
      destination: String(formData.get("destination") || ""),
      tripType: String(formData.get("tripType") || "motorcycle"),
      vehicle: String(formData.get("vehicle") || ""),
      pace: String(formData.get("pace") || "moderate"),
      budget: String(formData.get("budget") || "mid"),
      habits: String(formData.get("habits") || ""),
      meetpoints: String(formData.get("meetpoints") || "")
    });

    window.location.href = "dashboard.html";
  });
}

applyProfileToDashboard();

if (plannerForm && plannerDays) {
  plannerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(plannerForm);
    const input = {
      source: String(formData.get("source") || ""),
      destination: String(formData.get("destination") || ""),
      days: Number(formData.get("days") || 5),
      budget: String(formData.get("budget") || "mid"),
      tripType: String(formData.get("trip-type") || "motorcycle"),
      vehicle: String(formData.get("vehicle") || ""),
      habits: String(formData.get("habits") || ""),
      notes: String(formData.get("habits") || "")
    };

    if (plannerTitle) plannerTitle.textContent = "Planning your route...";
    if (plannerSummary) plannerSummary.textContent = "Asking the AI for a day-by-day plan.";
    plannerDays.innerHTML = "";
    if (plannerStatus) plannerStatus.textContent = "";
    if (plannerSource) plannerSource.textContent = "AI running";

    try {
      const itinerary = await fetchAI(input);
      renderItinerary(itinerary);
      if (plannerSource) plannerSource.textContent = "OpenAI";
      if (plannerStatus) plannerStatus.textContent = "Generated with AI.";
    } catch (error) {
      console.error("[planner]", error.message);
      renderItinerary(buildDemo(input));
      if (plannerSource) plannerSource.textContent = "Demo";
      if (plannerStatus) plannerStatus.textContent = `AI unavailable (${error.message}) - showing demo plan.`;
    }
  });
}
