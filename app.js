const MECK_PARCELS_URL = "https://gis.charlottenc.gov/arcgis/rest/services/CountyData/Parcels/MapServer/0/query";
const CENSUS_GEOCODE_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const ARCGIS_GEOCODE_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const MECK_AERIAL_2021_TILE_URL = "https://gis.charlottenc.gov/arcgis/rest/services/WEB/Aerial21/MapServer/tile/{z}/{y}/{x}";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const state = {
  mode: "cursor",
  featureIndex: 1,
  parcelLayer: null,
  shadowLayer: null,
  previewMarker: null,
  features: [],
  selectedLayer: null,
  activeDrawHandler: null,
  activeDrawKind: null
};

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const heightPreset = document.getElementById("heightPreset");
const startDrawBtn = document.getElementById("startDraw");
const deleteSelectedBtn = document.getElementById("deleteSelected");
const drawHelp = document.getElementById("drawHelp");
const drawHelpTitle = document.getElementById("drawHelpTitle");
const drawHelpText = document.getElementById("drawHelpText");
const monthSlider = document.getElementById("monthSlider");
const hourSlider = document.getElementById("hourSlider");
const monthLabel = document.getElementById("monthLabel");
const hourLabel = document.getElementById("hourLabel");

function setStatus(message) { statusEl.textContent = message; }
function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

const map = L.map("map", {
  zoomControl: true,
  maxZoom: 23,
  zoomSnap: 0.25,
  zoomDelta: 0.5
}).setView([35.2271, -80.8431], 12);

const aerial2021 = L.tileLayer(MECK_AERIAL_2021_TILE_URL, {
  attribution: "Aerial imagery © City of Charlotte / Mecklenburg County",
  minZoom: 10,
  maxZoom: 23,
  maxNativeZoom: 23,
  errorTileUrl: ""
});

const esriWorldImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles © Esri — imagery used for planning reference",
  maxZoom: 23,
  maxNativeZoom: 19,
  opacity: 0.95
}).addTo(map);

const osmLabels = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 23,
  maxNativeZoom: 19,
  opacity: 0.18
}).addTo(map);

L.control.layers(
  {
    "Esri world imagery — NC/SC search": esriWorldImagery,
    "Mecklenburg aerial 2021 — closest zoom": aerial2021
  },
  { "Street labels": osmLabels },
  { collapsed: true }
).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const polygonOptions = {
  allowIntersection: false,
  showArea: true,
  repeatMode: false,
  shapeOptions: { color: "#4f7c45", weight: 3, fillOpacity: .22 }
};
const lineOptions = {
  repeatMode: false,
  shapeOptions: { color: "#6f4e37", weight: 5 }
};

// Leaflet.Draw is still loaded for the drawing/editing engine, but the default toolbar is hidden.
const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems, remove: true },
  draw: false
});
map.addControl(drawControl);

function styleLayer(layer, type, selected = false) {
  const styles = {
    garden: { color: "#4f7c45", weight: selected ? 5 : 3, fillColor: "#4f7c45", fillOpacity: .25 },
    tree: { color: "#4a6736", weight: selected ? 5 : 3, fillColor: "#4a6736", fillOpacity: .35 },
    fence: { color: "#6f4e37", weight: selected ? 8 : 5, opacity: .95 },
    building: { color: "#5f4432", weight: selected ? 5 : 3, fillColor: "#5f4432", fillOpacity: .28 },
    shed: { color: "#9b6b43", weight: selected ? 5 : 3, fillColor: "#9b6b43", fillOpacity: .28 }
  };
  if (layer.setStyle && styles[type]) layer.setStyle(styles[type]);
}

function defaultHeightForMode(mode) {
  if (mode === "garden") return 0;
  if (mode === "fence") return 6;
  if (mode === "shed") return 10;
  if (mode === "building") return 20;
  if (mode === "tree") return Number(heightPreset.value) || 35;
  return Number(heightPreset.value) || 0;
}

function registerLayer(layer, type = state.mode) {
  if (type === "cursor") type = "garden";
  const id = `feature-${state.featureIndex++}`;
  const heightFeet = defaultHeightForMode(type);
  layer.sunflower = { id, type, heightFeet, label: `${titleCase(type)} ${state.featureIndex - 1}` };
  styleLayer(layer, type);
  drawnItems.addLayer(layer);
  state.features.push(layer);
  bindFeaturePopup(layer);
  wireSelection(layer);
  selectLayer(layer);
  clearShadows();
  updatePreview();
  setStatus(`Added ${type}. Use Cursor / edit to move vertices, change height, or delete it.`);
}

function wireSelection(layer) {
  layer.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    if (state.mode !== "cursor") return;
    selectLayer(layer);
    layer.openPopup();
  });
}

function selectLayer(layer) {
  if (state.selectedLayer && state.selectedLayer !== layer) {
    disableLayerEditing(state.selectedLayer);
    styleLayer(state.selectedLayer, state.selectedLayer.sunflower.type, false);
  }
  state.selectedLayer = layer;
  deleteSelectedBtn.disabled = !layer;
  if (layer) {
    styleLayer(layer, layer.sunflower.type, true);
    if (state.mode === "cursor") enableLayerEditing(layer);
  }
}

function enableLayerEditing(layer) {
  try { if (layer.editing) layer.editing.enable(); } catch (e) {}
}
function disableLayerEditing(layer) {
  try { if (layer.editing) layer.editing.disable(); } catch (e) {}
}
function disableAllLayerEditing() {
  state.features.forEach(disableLayerEditing);
}

map.on("click", () => {
  if (state.mode === "cursor") selectLayer(null);
});

function bindFeaturePopup(layer) {
  const meta = layer.sunflower;
  const html = `<div class="popup-control">
    <strong>${meta.label}</strong>
    <label>Type
      <select class="popup-type">
        ${["garden", "tree", "fence", "building", "shed"].map(t => `<option value="${t}" ${t === meta.type ? "selected" : ""}>${titleCase(t)}</option>`).join("")}
      </select>
    </label>
    <label>Height in feet
      <input class="popup-height" type="number" min="0" max="120" value="${meta.heightFeet}">
    </label>
    <button class="popup-save primary">Save</button>
    <button class="popup-delete secondary">Delete this shape</button>
  </div>`;
  layer.bindPopup(html);
  layer.on("popupopen", (e) => {
    const popup = e.popup.getElement();
    const save = popup.querySelector(".popup-save");
    const del = popup.querySelector(".popup-delete");
    save.addEventListener("click", () => {
      meta.type = popup.querySelector(".popup-type").value;
      meta.heightFeet = Number(popup.querySelector(".popup-height").value) || 0;
      meta.label = `${titleCase(meta.type)} ${meta.id.split("-")[1]}`;
      styleLayer(layer, meta.type, state.selectedLayer === layer);
      bindFeaturePopup(layer);
      layer.closePopup();
      clearShadows();
      updatePreview();
      setStatus(`Updated ${meta.label}.`);
    });
    del.addEventListener("click", () => deleteLayer(layer));
  });
}

function deleteLayer(layer) {
  if (!layer) return;
  disableLayerEditing(layer);
  drawnItems.removeLayer(layer);
  state.features = state.features.filter(l => l !== layer);
  if (state.selectedLayer === layer) selectLayer(null);
  clearShadows();
  updatePreview();
  setStatus("Deleted selected shape.");
}

deleteSelectedBtn.addEventListener("click", () => deleteLayer(state.selectedLayer));

function setMode(mode) {
  stopDrawing(false);
  state.mode = mode;
  document.querySelectorAll(".mode").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  heightPreset.value = String(defaultHeightForMode(mode));

  if (mode === "cursor") {
    startDrawBtn.textContent = "Cursor active — click a shape to edit";
    startDrawBtn.disabled = true;
    if (state.selectedLayer) enableLayerEditing(state.selectedLayer);
    setStatus("Cursor mode: click a shape to select it. Drag vertices to modify paths; use Delete selected shape to remove it.");
  } else {
    disableAllLayerEditing();
    startDrawBtn.disabled = false;
    startDrawBtn.textContent = mode === "fence" ? "Start fence line" : "Start polygon";
    setStatus(`${titleCase(mode)} mode. ${mode === "fence" ? "Fences use the line tool." : "This uses the polygon tool."}`);
  }
}

for (const btn of document.querySelectorAll(".mode")) {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
}

function startDrawing() {
  if (state.mode === "cursor") return;
  stopDrawing(false);
  disableAllLayerEditing();
  const isFence = state.mode === "fence";
  state.activeDrawKind = isFence ? "line" : "polygon";
  state.activeDrawHandler = isFence ? new L.Draw.Polyline(map, lineOptions) : new L.Draw.Polygon(map, polygonOptions);
  state.activeDrawHandler.enable();
  showDrawHelp(isFence);
}

function showDrawHelp(isFence) {
  drawHelp.classList.remove("hidden");
  drawHelpTitle.textContent = isFence ? "Drawing fence line" : `Drawing ${titleCase(state.mode)} polygon`;
  drawHelpText.textContent = isFence
    ? "Click along the fence path. Use Finish line when done, or double-click the last point."
    : "Click around the shape. Use Finish shape when done, or click the first point to close it.";
  document.getElementById("finishShape").textContent = isFence ? "Finish line" : "Finish shape";
}

function stopDrawing(shouldCancel = true) {
  if (state.activeDrawHandler) {
    try { state.activeDrawHandler.disable(); } catch (e) {}
  }
  state.activeDrawHandler = null;
  state.activeDrawKind = null;
  drawHelp.classList.add("hidden");
}

startDrawBtn.addEventListener("click", startDrawing);
document.getElementById("cancelDraw").addEventListener("click", () => {
  stopDrawing(true);
  setStatus("Drawing canceled.");
});
document.getElementById("undoPoint").addEventListener("click", () => {
  try { state.activeDrawHandler?.deleteLastVertex(); } catch (e) {}
});
document.getElementById("finishShape").addEventListener("click", () => {
  try { state.activeDrawHandler?._finishShape(); } catch (e) {
    setStatus("Add at least two points for a fence or three points for a polygon before finishing.");
  }
});

map.on(L.Draw.Event.CREATED, (event) => {
  const type = state.mode === "fence" ? "fence" : state.mode;
  stopDrawing(false);
  registerLayer(event.layer, type);
});

map.on(L.Draw.Event.EDITED, () => { clearShadows(); updatePreview(); });
map.on("draw:editvertex", () => { clearShadows(); updatePreview(); });

function isLikelyInMecklenburg(lat, lng) {
  return lat >= 35.0 && lat <= 35.55 && lng >= -81.15 && lng <= -80.55;
}

function isLikelyInCarolinas(lat, lng) {
  // Broad bounding box for North Carolina + South Carolina.
  return lat >= 32.0 && lat <= 36.75 && lng >= -84.5 && lng <= -75.2;
}

function normalizeAddressForCarolinas(address) {
  const hasState = /\bNC\b|\bSC\b|North Carolina|South Carolina/i.test(address);
  if (hasState) return address;

  const hasKnownCarolinaCity = /Charlotte|Mecklenburg|Matthews|Mint Hill|Huntersville|Cornelius|Davidson|Pineville|Raleigh|Durham|Chapel Hill|Greensboro|Winston-Salem|Asheville|Wilmington|Concord|Gastonia|Monroe|Rock Hill|Fort Mill|Indian Land|Lancaster|Columbia|Greenville|Spartanburg|Charleston|Mount Pleasant|Myrtle Beach/i.test(address);
  if (hasKnownCarolinaCity) return address;

  // Charlotte remains the best default because this prototype started as Mecklenburg-first.
  return `${address}, Charlotte, NC`;
}

function preferredCandidate(candidates) {
  return candidates
    .filter(c => c.score >= 75 && c.location && isLikelyInCarolinas(c.location.y, c.location.x))
    .sort((a, b) => {
      const aMeck = isLikelyInMecklenburg(a.location.y, a.location.x) ? 1 : 0;
      const bMeck = isLikelyInMecklenburg(b.location.y, b.location.x) ? 1 : 0;
      return (bMeck - aMeck) || (b.score - a.score);
    })[0];
}

async function geocodeWithArcGIS(address) {
  const url = new URL(ARCGIS_GEOCODE_URL);
  url.searchParams.set("f", "json");
  url.searchParams.set("singleLine", normalizeAddressForCarolinas(address));
  url.searchParams.set("outFields", "Match_addr,Addr_type,Score,Region,Subregion,City");
  url.searchParams.set("maxLocations", "10");
  url.searchParams.set("countryCode", "USA");
  url.searchParams.set("location", "-80.8431,35.2271");
  // Search extent covers NC + SC.
  url.searchParams.set("searchExtent", "-84.5,32.0,-75.2,36.75");
  url.searchParams.set("forStorage", "false");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("ArcGIS address lookup failed.");
  const data = await res.json();
  const candidates = data?.candidates || [];
  const good = preferredCandidate(candidates);
  if (!good) throw new Error("No North Carolina or South Carolina address match found from ArcGIS.");
  return { lat: good.location.y, lng: good.location.x, label: good.address, source: "ArcGIS" };
}

async function geocodeWithCensus(address) {
  const url = new URL(CENSUS_GEOCODE_URL);
  url.searchParams.set("address", normalizeAddressForCarolinas(address));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Census address lookup failed.");
  const data = await res.json();
  const matches = data?.result?.addressMatches || [];
  const match = matches.find(m => isLikelyInCarolinas(m.coordinates.y, m.coordinates.x));
  if (!match) throw new Error("No Census address match found in North Carolina or South Carolina.");
  return { lat: match.coordinates.y, lng: match.coordinates.x, label: match.matchedAddress, source: "Census" };
}

async function geocodeAddress(address) {
  const errors = [];
  try { return await geocodeWithArcGIS(address); } catch (err) { errors.push(err.message); }
  try { return await geocodeWithCensus(address); } catch (err) { errors.push(err.message); }
  throw new Error(`Address lookup failed. ${errors.join(" ")}`);
}

function applyBestBasemapForLocation(lat, lng) {
  if (isLikelyInMecklenburg(lat, lng)) {
    if (map.hasLayer(esriWorldImagery)) map.removeLayer(esriWorldImagery);
    if (!map.hasLayer(aerial2021)) aerial2021.addTo(map);
  } else {
    if (map.hasLayer(aerial2021)) map.removeLayer(aerial2021);
    if (!map.hasLayer(esriWorldImagery)) esriWorldImagery.addTo(map);
  }
  if (!map.hasLayer(osmLabels)) osmLabels.addTo(map);
}

async function loadParcel(lat, lng) {
  const url = new URL(MECK_PARCELS_URL);
  url.searchParams.set("f", "geojson");
  url.searchParams.set("geometry", `${lng},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Parcel service did not respond.");
  const geojson = await res.json();
  if (!geojson.features?.length) throw new Error("No Mecklenburg parcel found at this location.");
  if (state.parcelLayer) map.removeLayer(state.parcelLayer);
  state.parcelLayer = L.geoJSON(geojson, {
    style: { color: "#e7a928", weight: 4, fillColor: "#e7a928", fillOpacity: .12 }
  }).addTo(map);
  map.fitBounds(state.parcelLayer.getBounds(), { padding: [28, 28], maxZoom: 21 });
  return geojson.features[0];
}

async function handleLocation(lat, lng, label = "Selected location") {
  if (!isLikelyInCarolinas(lat, lng)) {
    setStatus("That location appears to be outside North Carolina or South Carolina. You can still draw manually, but address search is tuned for NC/SC.");
  }
  applyBestBasemapForLocation(lat, lng);
  const inMeck = isLikelyInMecklenburg(lat, lng);
  setStatus(inMeck ? `Loading Mecklenburg parcel for ${label}...` : `Centered on ${label}. Parcel lookup is currently enhanced for Mecklenburg County only.`);
  map.setView([lat, lng], inMeck ? 21 : 19);
  if (state.previewMarker) map.removeLayer(state.previewMarker);
  state.previewMarker = L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();

  if (!inMeck) {
    if (state.parcelLayer) { map.removeLayer(state.parcelLayer); state.parcelLayer = null; }
    setStatus("Address found in NC/SC. Outside Mecklenburg, draw garden beds and shade blockers manually, then preview shadows or run an estimate.");
    return;
  }

  try {
    await loadParcel(lat, lng);
    setStatus("Mecklenburg parcel loaded. Draw garden polygons and shade blockers, then preview shadows or run an estimate.");
  } catch (err) {
    setStatus(`${err.message} You can still draw a yard area manually.`);
  }
}

document.getElementById("searchAddress").addEventListener("click", async () => {
  const address = document.getElementById("addressInput").value.trim();
  if (!address) return setStatus("Enter an address first.");
  try {
    setStatus("Searching address... For best results, include city + NC or SC, for example: 600 E 4th St, Charlotte, NC");
    const loc = await geocodeAddress(address);
    await handleLocation(loc.lat, loc.lng, `${loc.label} (${loc.source})`);
  } catch (err) {
    setStatus(`${err.message} Try “use my location,” include NC/SC in the address, or zoom to your property and draw manually.`);
  }
});

document.getElementById("useLocation").addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Geolocation is not available in this browser.");
  setStatus("Getting your location...");
  navigator.geolocation.getCurrentPosition(
    pos => handleLocation(pos.coords.latitude, pos.coords.longitude, "Your location"),
    () => setStatus("Could not access location. You can still search by address or draw manually."),
    { enableHighAccuracy: true, timeout: 12000 }
  );
});

document.getElementById("resetMap").addEventListener("click", () => {
  stopDrawing(false);
  clearShadows();
  drawnItems.clearLayers();
  state.features = [];
  selectLayer(null);
  if (state.parcelLayer) { map.removeLayer(state.parcelLayer); state.parcelLayer = null; }
  if (state.previewMarker) { map.removeLayer(state.previewMarker); state.previewMarker = null; }
  document.getElementById("addressInput").value = "";
  resultsEl.innerHTML = `<div class="results-empty">Draw at least one garden bed and one or more likely shade blockers, then run the estimate.</div>`;
  applyBestBasemapForLocation(35.2271, -80.8431);
  map.setView([35.2271, -80.8431], 12);
  setMode("cursor");
  setStatus("Map reset. Search an NC/SC address or use your location to start again.");
});

document.getElementById("runAnalysis").addEventListener("click", runAnalysis);
document.getElementById("runAnalysisTop").addEventListener("click", runAnalysis);
document.getElementById("previewShadow").addEventListener("click", updatePreview);
monthSlider.addEventListener("input", updateSliderLabelsAndPreview);
hourSlider.addEventListener("input", updateSliderLabelsAndPreview);

function updateSliderLabelsAndPreview() {
  monthLabel.textContent = monthNames[Number(monthSlider.value) - 1];
  hourLabel.textContent = new Date(`2026-01-01T${String(hourSlider.value).padStart(2, "0")}:00:00`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  updatePreview();
}

function layerToFeature(layer) {
  if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
    const coords = layer.getLatLngs().map(ll => [ll.lng, ll.lat]);
    return turf.lineString(coords);
  }
  return layer.toGeoJSON();
}

function getGardenLayers() { return state.features.filter(l => l.sunflower?.type === "garden"); }
function getObstacleLayers() { return state.features.filter(l => l.sunflower?.type !== "garden" && Number(l.sunflower?.heightFeet) > 0); }
function selectedDates() { return Array.from(document.querySelectorAll(".datePreset:checked")).map(input => input.value); }
function getMapCenterLatLng() { const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; }

function sunBearingFromNorth(date, lat, lng) {
  const pos = SunCalc.getPosition(date, lat, lng);
  const altitude = pos.altitude;
  const bearing = (pos.azimuth * 180 / Math.PI + 180 + 360) % 360;
  return { altitude, bearing };
}

function previewDateFromSliders() {
  const month = String(monthSlider.value).padStart(2, "0");
  const hour = String(hourSlider.value).padStart(2, "0");
  return new Date(`2026-${month}-21T${hour}:00:00`);
}

function updatePreview() {
  clearShadows();
  const obstacles = getObstacleLayers();
  if (!obstacles.length) return;
  const center = getMapCenterLatLng();
  const date = previewDateFromSliders();
  const shadowFeatures = obstacles.map(o => makeShadowForObstacle(o, date, center.lat, center.lng)).filter(Boolean);
  if (shadowFeatures.length) {
    state.shadowLayer = L.geoJSON(turf.featureCollection(shadowFeatures), {
      style: { color: "#3d3227", weight: 0, fillColor: "#3d3227", fillOpacity: .24 }
    }).addTo(map);
  }
  setStatus(`Previewing estimated shadows for ${monthNames[Number(monthSlider.value)-1]} 21 at ${hourLabel.textContent}.`);
}

function makeShadowForObstacle(layer, date, lat, lng) {
  const hFeet = Number(layer.sunflower.heightFeet) || 0;
  if (hFeet <= 0) return null;
  const { altitude, bearing } = sunBearingFromNorth(date, lat, lng);
  if (altitude <= 0.05) return null;
  const hMeters = hFeet * 0.3048;
  const lengthMeters = Math.min(260, hMeters / Math.tan(altitude));
  const shadowBearing = (bearing + 180) % 360;
  const feature = layerToFeature(layer);

  if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
    const buffered = turf.buffer(feature, Math.max(1.2, hMeters / 8), { units: "meters" });
    return extrudePolygon(buffered, shadowBearing, lengthMeters);
  }
  return extrudePolygon(feature, shadowBearing, lengthMeters);
}

function extrudePolygon(feature, bearing, meters) {
  try {
    const coords = [];
    turf.coordEach(feature, (coord) => {
      coords.push(coord);
      coords.push(turf.destination(turf.point(coord), meters, bearing, { units: "meters" }).geometry.coordinates);
    });
    const hull = turf.convex(turf.featureCollection(coords.map(c => turf.point(c))));
    return hull;
  } catch (e) { return null; }
}

function intersectsShadow(gardenLayer, shadowFeature) {
  if (!shadowFeature) return false;
  try {
    return turf.booleanIntersects(layerToFeature(gardenLayer), shadowFeature);
  } catch (e) { return false; }
}

function clearShadows() {
  if (state.shadowLayer) {
    map.removeLayer(state.shadowLayer);
    state.shadowLayer = null;
  }
}

function runAnalysis() {
  clearShadows();
  const gardens = getGardenLayers();
  const obstacles = getObstacleLayers();
  const dates = selectedDates();
  const startHour = Math.max(5, Number(document.getElementById("startHour").value) || 8);
  const endHour = Math.min(21, Number(document.getElementById("endHour").value) || 18);
  const center = getMapCenterLatLng();

  if (!gardens.length) {
    resultsEl.innerHTML = `<div class="results-empty">Draw at least one garden bed first. Choose Garden bed, then Start polygon.</div>`;
    return;
  }
  if (!dates.length) {
    resultsEl.innerHTML = `<div class="results-empty">Select at least one date.</div>`;
    return;
  }

  const shadowFeatures = [];
  const rows = gardens.map((gardenLayer, idx) => {
    let sunny = 0, total = 0;
    const byDate = [];
    for (const dateStr of dates) {
      let sunnyForDate = 0, totalForDate = 0;
      for (let hour = startHour; hour <= endHour; hour++) {
        const date = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`);
        const { altitude } = sunBearingFromNorth(date, center.lat, center.lng);
        if (altitude <= 0) continue;
        total++; totalForDate++;
        const shadows = obstacles.map(o => makeShadowForObstacle(o, date, center.lat, center.lng)).filter(Boolean);
        shadows.forEach(s => shadowFeatures.push(s));
        const shaded = shadows.some(s => intersectsShadow(gardenLayer, s));
        if (!shaded) { sunny++; sunnyForDate++; }
      }
      byDate.push({ date: dateStr, sunny: sunnyForDate, total: totalForDate });
    }
    const avgSun = dates.length ? sunny / dates.length : 0;
    return { idx: idx + 1, avgSun, sunny, total, byDate, classification: classify(avgSun) };
  });

  if (shadowFeatures.length) {
    state.shadowLayer = L.geoJSON(turf.featureCollection(shadowFeatures.slice(0, 350)), {
      style: { color: "#3d3227", weight: 0, fillColor: "#3d3227", fillOpacity: .18 }
    }).addTo(map);
  }
  renderResults(rows, obstacles.length);
  setStatus(`Analysis complete. ${gardens.length} garden spot(s), ${obstacles.length} blocker(s), ${dates.length} date(s).`);
}

function classify(hours) {
  if (hours >= 6) return { label: "Full sun", note: "Best for tomatoes, peppers, cucumbers, squash, okra, and most summer vegetables." };
  if (hours >= 4) return { label: "Partial sun", note: "Usable for herbs, greens, beans, and some root crops. Riskier for fruiting vegetables." };
  if (hours >= 2) return { label: "Limited sun", note: "Better for shade-tolerant herbs and greens. Not ideal for high-yield vegetable beds." };
  return { label: "Mostly shade", note: "Probably not a strong vegetable garden spot unless trees/blockers are incorrect." };
}

function renderResults(rows, obstacleCount) {
  rows.sort((a, b) => b.avgSun - a.avgSun);
  resultsEl.innerHTML = rows.map((row, rank) => {
    const confidence = obstacleCount === 0 ? "Low — no blockers added" : obstacleCount < 3 ? "Medium — add major trees/fences" : "Better — blockers included";
    const dateTags = row.byDate.map(d => {
      const label = new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `<span class="tag">${label}: ${d.sunny}h</span>`;
    }).join("");
    return `<article class="result">
      <div class="result-grid">
        <div>
          <h3>${rank === 0 ? "Best current option" : `Garden spot ${row.idx}`}</h3>
          <div class="score">${row.avgSun.toFixed(1)}h</div>
          <p class="muted">Average estimated direct sun per selected date.</p>
        </div>
        <div>
          <span class="tag">${row.classification.label}</span>
          <span class="tag">Confidence: ${confidence}</span>
        </div>
      </div>
      <p>${row.classification.note}</p>
      <div>${dateTags}</div>
    </article>`;
  }).join("");
}

setMode("cursor");
updateSliderLabelsAndPreview();
