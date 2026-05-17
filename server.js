const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PUBLIC_DIR = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });

    request.on("error", reject);
  });
}

function itinerarySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      days: {
        type: "array",
        minItems: 1,
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            day: { type: "integer" },
            title: { type: "string" },
            description: { type: "string" },
            morning: { type: "string" },
            afternoon: { type: "string" },
            evening: { type: "string" }
          },
          required: ["day", "title", "description", "morning", "afternoon", "evening"]
        }
      }
    },
    required: ["title", "summary", "days"]
  };
}

async function generateItinerary(input) {
  const destination = String(input.destination || "").trim();
  const days = Math.min(Math.max(Number(input.days || 5), 1), 7);
  const budget = String(input.budget || "mid-range");
  const vibe = String(input.vibe || "balanced");
  const notes = String(input.notes || "").trim();

  if (!destination) {
    throw new Error("Destination is required.");
  }

  if (!OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const prompt = [
    "Create a realistic travel itinerary for a social travel companion app.",
    `Destination: ${destination}`,
    `Trip length: ${days} days`,
    `Budget: ${budget}`,
    `Travel vibe: ${vibe}`,
    `Must-have plans: ${notes || "Balanced local highlights, food, downtime, and safe logistics."}`,
    "Keep it practical, specific, and friendly for solo travelers meeting compatible travel friends.",
    "Return only the structured itinerary requested by the schema."
  ].join("\n");

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "travel_itinerary",
          strict: true,
          schema: itinerarySchema()
        }
      },
      messages: [
        {
          role: "system",
          content: "You are a travel planner. Always respond with valid JSON matching the requested schema exactly. No extra text."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!openaiResponse.ok) {
    const message = await openaiResponse.text();
    const error = new Error(`OpenAI request failed (${openaiResponse.status}): ${message}`);
    error.statusCode = 502;
    throw error;
  }

  const data = await openaiResponse.json();

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    const error = new Error("OpenAI returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error(`OpenAI response was not valid JSON: ${raw.slice(0, 200)}`);
    error.statusCode = 502;
    throw error;
  }
}

async function handleApiItinerary(request, response) {
  try {
    const input = await readJsonBody(request);
    const itinerary = await generateItinerary(input);
    sendJson(response, 200, itinerary);
  } catch (error) {
    console.error("[itinerary error]", error.message);
    sendJson(response, error.statusCode || 400, {
      error: error.message || "Could not generate itinerary."
    });
  }
}

async function handleStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/itinerary") {
    handleApiItinerary(request, response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    handleStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`RoamCircle running at http://localhost:${PORT}`);
});