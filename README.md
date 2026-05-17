# Sunflower Mecklenburg

A local prototype for estimating garden sunlight in Mecklenburg County, NC.

## Run locally

```bash
cd sunflower-mecklenburg
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## What changed in this version

- Address lookup now tries ArcGIS World Geocoding first, scoped toward Mecklenburg County.
- The U.S. Census Geocoder remains as a fallback.
- The map now uses Mecklenburg/Charlotte aerial imagery as the main basemap.
- The Leaflet map is configured to zoom much closer, up to zoom level 23 where tiles are available.
- Esri World Imagery is available as a fallback basemap through the layer control.

## Known limits

- Public map data cannot reliably know fence height, recent tree removal, pruning, or small yard structures.
- The app estimates shade based on user-drawn blockers and rough height assumptions.
- Parcel lookup depends on the Charlotte/Mecklenburg ArcGIS REST service being available from the browser.
