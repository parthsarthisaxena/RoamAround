const plannerForm = document.querySelector("#planner-form");
const plannerTitle = document.querySelector("#planner-title");
const plannerSummary = document.querySelector("#planner-summary");
const plannerDays = document.querySelector("#planner-days");
const plannerStatus = document.querySelector("#planner-status");
const plannerSource = document.querySelector("#planner-source");
const requestCount = document.querySelector("#request-count");
const requestCards = document.querySelectorAll("[data-request-card]");

const demoTemplates = {
  balanced: [
    ["Arrive and settle into the best base", "Check into a walkable area, do a light neighborhood loop, and choose an easy dinner."],
    ["Start with one signature local experience", "Use the morning for a scenic highlight, then leave the afternoon open for cafes and photos."],
    ["Mix social energy with downtime", "Plan one shared activity, one relaxed meal, and enough space for the group to recharge."],
    ["Explore beyond the obvious route", "Add a nearby neighborhood, market, coast, or gallery district that gives the trip texture."],
    ["Close with a calm final-day memory", "Keep logistics light with brunch, a spa or beach stop, and reliable transport timing."],
    ["Add a flexible day trip", "Use this day for an island hop, train ride, countryside route, or weather-dependent plan."],
    ["Make departure simple", "Stay close to your base, grab one last meal, and avoid tight timing."]
  ],
  adventure: [
    ["Arrive and get moving", "Drop bags, scout the area, and add a walk, ride, surf session, or light trail."],
    ["Use the best weather window", "Put the hardest physical activity early, then recover with a casual meal."],
    ["Pair adrenaline with scenery", "Stack one active plan with a viewpoint, waterfall, beach, or sunset stop."],
    ["Take the longer route", "Use scooters, bikes, or a road-trip-style day to find smaller places organically."],
    ["End with a sunrise or sunset push", "Close the trip with a memorable active plan and easy logistics."],
    ["Hold one challenge day", "Keep space for hikes, dives, canyon routes, or weather-dependent transfers."],
    ["Recover before departure", "Stretch, eat well, and keep the final day generous."]
  ],
  social: [
    ["Ease in with dinner and drinks", "Start close to the stay so the group can settle in naturally."],
    ["Choose a shared daytime activity", "A food walk, boat ride, group class, or beach setup creates quick momentum."],
    ["Leave room for spontaneous add-ons", "Keep an open block so new ideas can enter the trip."],
    ["Use the most social district", "Pick live music, rooftops, markets, or a bar street where plans can flex."],
    ["Close with a shared ritual", "Book a farewell dinner, picnic, or sunset stop that feels like a proper ending."],
    ["Add a low-pressure conversation block", "Use coworking, brunch, or a long cafe stop to make the group feel less transactional."],
    ["Coordinate departure day", "Align luggage, transport, and one final meal."]
  ],
  food: [
    ["Start with a local welcome meal", "Choose a first dinner that represents the destination without overloading arrival day."],
    ["Build the morning around markets", "Start with bakeries, coffee, or produce spots, then walk nearby streets."],
    ["Make lunch the centerpiece", "Book a signature spot or street-food crawl and keep the rest of the day lighter."],
    ["Balance meals with movement", "Add parks, galleries, or coastal walks between bigger food moments."],
    ["End with the reservation", "Use the final night for the table or tasting worth planning around."],
    ["Protect a snack-and-wander day", "Leave room for spontaneous cafes, desserts, and local finds."],
    ["Keep departure close", "Choose one last brunch or coffee stop near the stay."]
  ],
  wellness: [
    ["Arrive softly", "Skip the rush with a calm meal, gentle walk, and quiet evening."],
    ["Anchor the morning", "Use sunrise for yoga, tea, journaling, stretching, or an easy swim."],
    ["Blend nature with light structure", "Choose gardens, beaches, spa blocks, or scenic drives."],
    ["Leave space on purpose", "Protect time for naps, reading, coworking, or simply being somewhere beautiful."],
    ["End grounded", "Book a massage, long brunch, sound bath, or calm coastal stop."],
    ["Use one deeper reset day", "Try a spa circuit, thermal bath, or countryside retreat."],
    ["Make departure ultra-simple", "Use reliable transport and one familiar cafe before leaving."]
  ]
};

function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function buildDemoItinerary(input) {
  const destination = titleCase(input.destination.trim() || "Your Trip");
  const templates = demoTemplates[input.vibe] || demoTemplates.balanced;
  const days = templates.slice(0, input.days).map((item, index) => ({
    day: index + 1,
    title: item[0],
    description: item[1],
    morning: "Start with the highest-energy plan while timing is easiest.",
    afternoon: "Keep the middle of the day flexible for food, transit, or weather.",
    evening: "Choose a group-friendly dinner or calm reset depending on energy."
  }));

  return {
    title: `${input.days}-day ${destination} flow`,
    summary: `A ${input.budget} ${input.vibe} draft for ${destination}. Focus areas: ${input.notes || "local highlights, downtime, and safe logistics"}.`,
    days
  };
}

function renderItinerary(itinerary) {
  plannerTitle.textContent = itinerary.title;
  plannerSummary.textContent = itinerary.summary;
  plannerDays.innerHTML = itinerary.days
    .map((day) => `
      <article class="day-card">
        <span>Day ${day.day}</span>
        <strong>${day.title}</strong>
        <p>${day.description}</p>
        <p><strong>Morning:</strong> ${day.morning}</p>
        <p><strong>Afternoon:</strong> ${day.afternoon}</p>
        <p><strong>Evening:</strong> ${day.evening}</p>
      </article>
    `)
    .join("");
}

async function fetchAiItinerary(input) {
  const response = await fetch("/api/itinerary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "AI itinerary generation failed.");
  }

  return response.json();
}

if (plannerForm && plannerTitle && plannerSummary && plannerDays && plannerStatus && plannerSource) {
  plannerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(plannerForm);
    const input = {
      destination: String(formData.get("destination") || ""),
      days: Number(formData.get("days") || 5),
      budget: String(formData.get("budget") || "mid-range"),
      vibe: String(formData.get("vibe") || "balanced"),
      notes: String(formData.get("notes") || "")
    };

    plannerTitle.textContent = "Building your trip...";
    plannerSummary.textContent = "Asking the AI planner for a practical day-by-day route.";
    plannerDays.innerHTML = "";
    plannerStatus.textContent = "";
    plannerSource.textContent = "AI running";

    try {
      const itinerary = await fetchAiItinerary(input);
      renderItinerary(itinerary);
      plannerSource.textContent = "OpenAI";
      plannerStatus.textContent = "Generated with the backend AI route.";
    } catch (error) {
      console.error("[planner error]", error.message);
      renderItinerary(buildDemoItinerary(input));
      plannerSource.textContent = "Demo draft";
      plannerStatus.textContent = error.message.includes("OPENAI_API_KEY")
        ? "No API key configured — showing demo output."
        : `AI unavailable (${error.message}) — showing demo output.`;
    }
  });
}