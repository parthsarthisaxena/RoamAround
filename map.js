/* ─── RoamAround map.js — Interactive Route & Convoy Waypoints Map ───
 * Lightweight Leaflet-based map component.
 * Features:
 *  - Auto tile theme switching (CartoDB Dark Matter & Positron)
 *  - Known city coordinates cache + Nominatim geocode fallback
 *  - Custom animated convoy route polylines and waypoint pins
 *  - Google Maps navigation link generator
 *  - GPX export for GPS bike navigation units
 ──────────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  // Pre-cached coordinates for overland and riding hubs [lat, lng]
  const KNOWN_COORDS = {
    "mumbai":      [19.0760, 72.8777],
    "pune":        [18.5204, 73.8567],
    "nashik":      [19.9975, 73.7898],
    "surat":       [21.1702, 72.8311],
    "vadodara":    [22.3072, 73.1812],
    "ahmedabad":   [23.0225, 72.5714],
    "udaipur":     [24.5854, 73.7125],
    "jaipur":      [26.9124, 75.7873],
    "delhi":       [28.6139, 77.2090],
    "new delhi":   [28.6139, 77.2090],
    "gurugram":    [28.4595, 77.0266],
    "noida":       [28.5355, 77.3910],
    "chandigarh":  [30.7333, 76.7794],
    "shimla":      [31.1048, 77.1734],
    "manali":      [32.2432, 77.1892],
    "jispa":       [32.6394, 77.1884],
    "keylong":     [32.5710, 77.0320],
    "sarchu":      [32.9090, 77.5830],
    "pangong":     [33.7595, 78.6674],
    "nubra":       [34.6863, 77.5673],
    "nubra valley":[34.6863, 77.5673],
    "leh":         [34.1526, 77.5771],
    "ladakh":      [34.1526, 77.5771],
    "kargil":      [34.5539, 76.1349],
    "drass":       [34.4294, 75.7533],
    "sonamarg":    [34.3106, 75.2938],
    "srinagar":    [34.0837, 74.7973],
    "jammu":       [32.7266, 74.8570],
    "kaza":        [32.2276, 78.0710],
    "spiti":       [32.2461, 78.0349],
    "spiti valley":[32.2461, 78.0349],
    "tabo":        [32.0927, 78.3812],
    "nako":        [31.8797, 78.6276],
    "kalpa":       [31.5372, 78.2568],
    "bangalore":   [12.9716, 77.5946],
    "bengaluru":   [12.9716, 77.5946],
    "mysore":      [12.2958, 76.6394],
    "mysuru":      [12.2958, 76.6394],
    "coorg":       [12.3375, 75.8069],
    "mangalore":   [12.9141, 74.8560],
    "goa":         [15.2993, 74.1240],
    "panaji":      [15.4909, 73.8278],
    "chennai":     [13.0827, 80.2707],
    "hyderabad":   [17.3850, 78.4867],
    "kochi":       [9.9312,  76.2673],
    "munnar":      [10.0889, 77.0595],
    "wayanad":     [11.6854, 76.1320],
    "ooty":        [11.4102, 76.6950],
    "kolkata":     [22.5726, 88.3639],
    "darjeeling":  [27.0410, 88.2663],
    "gangtok":     [27.3389, 88.6065],
    "shillong":    [25.5788, 91.8933],
    "guwahati":    [26.1445, 91.7362]
  };

  const geocodeCache = { ...KNOWN_COORDS };
  const mapInstances = {};

  // Tile endpoints
  const DARK_TILES  = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const TILE_ATTR   = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  function isLightMode() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  // Geocoding with fallback to Nominatim
  async function geocode(cityName) {
    if (!cityName) return null;
    const clean = String(cityName).trim().toLowerCase().replace(/[\(\)\[\],.]/g, "");
    if (geocodeCache[clean]) return geocodeCache[clean];

    // Try finding prefix match in known cache
    for (const [k, coords] of Object.entries(geocodeCache)) {
      if (clean.startsWith(k) || k.startsWith(clean)) return coords;
    }

    // Fallback to online OpenStreetMap geocoding
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`, {
        headers: { "Accept-Language": "en" }
      });
      const data = await res.json();
      if (data && data[0]) {
        const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        geocodeCache[clean] = coords;
        return coords;
      }
    } catch {}

    return null;
  }

  // Custom marker pin creator
  function makeMarkerIcon(label, type = "waypoint", stepNum = null) {
    if (typeof L === "undefined") return null;

    let iconClass = "rc-map-pin";
    let badgeHtml = "";

    if (type === "source") {
      iconClass += " pin-source";
      badgeHtml = `<span class="pin-badge">START</span>`;
    } else if (type === "destination") {
      iconClass += " pin-dest";
      badgeHtml = `<span class="pin-badge">END</span>`;
    } else if (stepNum != null) {
      iconClass += " pin-step";
      badgeHtml = `<span class="pin-step-num">${stepNum}</span>`;
    }

    return L.divIcon({
      className: "rc-custom-marker",
      html: `
        <div class="${iconClass}">
          <div class="pin-dot"></div>
          ${badgeHtml}
          <div class="pin-tooltip">${label}</div>
        </div>
      `,
      iconSize: [30, 42],
      iconAnchor: [15, 38],
      popupAnchor: [0, -36]
    });
  }

  // Render or update an interactive route map
  async function renderRouteMap(containerId, waypoints) {
    if (typeof L === "undefined") {
      console.warn("[RC_map] Leaflet not loaded");
      return null;
    }

    const container = document.getElementById(containerId);
    if (!container) return null;

    // Filter valid waypoints & geocode them
    const resolvedPoints = [];
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const name = typeof wp === "string" ? wp : wp.name;
      const type = typeof wp === "string" ? (i === 0 ? "source" : (i === waypoints.length - 1 ? "destination" : "meetpoint")) : (wp.type || "meetpoint");
      const coords = (wp && Array.isArray(wp.coords)) ? wp.coords : await geocode(name);

      if (coords) {
        resolvedPoints.push({
          name: name || `Stop ${i + 1}`,
          type,
          coords,
          day: wp?.day || null,
          note: wp?.note || ""
        });
      }
    }

    if (resolvedPoints.length < 2) {
      container.innerHTML = `
        <div class="map-placeholder">
          <span>📍</span>
          <p>Add source, destination, and meetpoints to preview your visual route.</p>
        </div>`;
      return null;
    }

    // Clean up previous map instance on this container if present
    if (mapInstances[containerId]) {
      try { mapInstances[containerId].map.remove(); } catch {}
      delete mapInstances[containerId];
    }

    container.innerHTML = "";

    const map = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false
    });

    const tileUrl = isLightMode() ? LIGHT_TILES : DARK_TILES;
    const tileLayer = L.tileLayer(tileUrl, {
      attribution: TILE_ATTR,
      maxZoom: 18,
      subdomains: "abcd"
    }).addTo(map);

    const latLngs = [];
    const markers = [];

    resolvedPoints.forEach((pt, idx) => {
      latLngs.push(pt.coords);
      const isFirst = idx === 0;
      const isLast  = idx === resolvedPoints.length - 1;
      const pType   = isFirst ? "source" : (isLast ? "destination" : "waypoint");
      const step    = (!isFirst && !isLast) ? idx : null;

      const icon = makeMarkerIcon(pt.name, pType, step);
      const marker = L.marker(pt.coords, { icon, title: pt.name }).addTo(map);

      let popupContent = `<strong>${pt.name}</strong>`;
      if (pt.day) popupContent += `<br><span style="color:#1DB954">Day ${pt.day}</span>`;
      if (pt.note) popupContent += `<br><span style="font-size:0.75rem;color:#888">${pt.note}</span>`;
      marker.bindPopup(popupContent);

      markers.push(marker);
    });

    // Draw route polyline
    const polyline = L.polyline(latLngs, {
      color: "#1DB954",
      weight: 4,
      opacity: 0.85,
      dashArray: "8, 6",
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    // Glowing outline behind the polyline
    const glowLine = L.polyline(latLngs, {
      color: "#1DB954",
      weight: 10,
      opacity: 0.18,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    // Fit map view to bounds
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });

    mapInstances[containerId] = {
      map,
      tileLayer,
      polyline,
      glowLine,
      markers,
      waypoints: resolvedPoints
    };

    // Trigger invalidateSize once layout stabilizes
    setTimeout(() => { map.invalidateSize(); }, 200);

    return mapInstances[containerId];
  }

  // Quick helper for Trip Drawer
  async function renderTripDrawerMap(trip) {
    if (!trip) return;
    const waypoints = [];
    if (trip.from) waypoints.push({ name: trip.from, type: "source" });

    if (trip.meetpoints) {
      const parts = String(trip.meetpoints).split(/[,\/]+/).map(s => s.trim()).filter(Boolean);
      parts.forEach(p => waypoints.push({ name: p, type: "meetpoint" }));
    }

    if (trip.to) waypoints.push({ name: trip.to, type: "destination" });

    const res = await renderRouteMap("td-route-map", waypoints);

    // Wire action buttons
    const gmapsBtn = document.getElementById("td-open-gmaps-btn");
    if (gmapsBtn) {
      gmapsBtn.onclick = () => openInGoogleMaps(waypoints);
    }
    const gpxBtn = document.getElementById("td-download-gpx-btn");
    if (gpxBtn) {
      gpxBtn.onclick = () => exportGpx(`${trip.from || "Route"}_to_${trip.to || "Destination"}`, waypoints);
    }

    return res;
  }

  // Quick helper for AI Route Planner
  async function renderPlannerMap(source, destination, stops) {
    const waypoints = [];
    if (source) waypoints.push({ name: source, type: "source" });

    if (Array.isArray(stops)) {
      stops.forEach((st, idx) => {
        if (st.location && st.location !== source && st.location !== destination) {
          waypoints.push({ name: st.location, type: "waypoint", day: st.day || idx + 1, note: st.title || "" });
        }
      });
    }

    if (destination) waypoints.push({ name: destination, type: "destination" });

    return renderRouteMap("planner-route-map", waypoints);
  }

  // Multi-stop Google Maps URL builder
  function getGoogleMapsUrl(waypoints) {
    if (!waypoints || !waypoints.length) return "https://www.google.com/maps";
    const names = waypoints.map(w => encodeURIComponent(typeof w === "string" ? w : w.name)).filter(Boolean);
    if (!names.length) return "https://www.google.com/maps";
    if (names.length === 1) return `https://www.google.com/maps/search/?api=1&query=${names[0]}`;

    const origin = names[0];
    const destination = names[names.length - 1];
    const waypointsParam = names.slice(1, -1).join("%7C");

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypointsParam) url += `&waypoints=${waypointsParam}`;
    url += "&travelmode=driving";
    return url;
  }

  function openInGoogleMaps(waypoints) {
    const url = getGoogleMapsUrl(waypoints);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Standard GPX XML file generator
  async function exportGpx(tripTitle, waypoints) {
    const safeTitle = (tripTitle || "RoamAround_Route").replace(/[^a-zA-Z0-9_-]/g, "_");
    const resolved = [];

    for (const wp of waypoints) {
      const name = typeof wp === "string" ? wp : wp.name;
      const coords = (wp && Array.isArray(wp.coords)) ? wp.coords : await geocode(name);
      if (coords) resolved.push({ name, lat: coords[0], lon: coords[1] });
    }

    if (!resolved.length) return;

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RoamAround - https://roamaround.app" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeTitle}</name>
    <desc>RoamAround Convoy Route Plan</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${safeTitle}</name>
    <trkseg>
`;

    resolved.forEach(pt => {
      gpx += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}"><name>${pt.name}</name></trkpt>\n`;
    });

    gpx += `    </trkseg>
  </trk>
`;

    resolved.forEach(pt => {
      gpx += `  <wpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}"><name>${pt.name}</name></wpt>\n`;
    });

    gpx += `</gpx>`;

    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${safeTitle}.gpx`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      if (link.remove) link.remove();
      else if (link.parentNode) link.parentNode.removeChild(link);
    }, 100);
  }

  // Handle theme changes
  document.addEventListener("rc:theme-changed", () => {
    const light = isLightMode();
    const newTileUrl = light ? LIGHT_TILES : DARK_TILES;

    Object.values(mapInstances).forEach(inst => {
      if (inst && inst.map && inst.tileLayer) {
        inst.tileLayer.setUrl(newTileUrl);
      }
    });
  });

  window.RC_map = {
    renderRouteMap,
    renderTripDrawerMap,
    renderPlannerMap,
    getGoogleMapsUrl,
    openInGoogleMaps,
    exportGpx,
    geocode
  };

})();
