# RoamCircle

TripBFF-style travel companion website with AI itinerary generation.

## Run locally

Install Node.js first if `node -v` does not work in PowerShell.

```powershell
$env:OPENAI_API_KEY="your_openai_api_key_here"
npm start
```

Then open:

```text
http://localhost:3000
```

The page still works by opening `index.html` directly, but real AI itinerary generation requires the local server because the API key must stay on the backend.
