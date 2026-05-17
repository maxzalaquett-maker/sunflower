# Sunflower

A FARM127 field-tool prototype for estimating garden sunlight in North Carolina and South Carolina, with enhanced Mecklenburg County support.

## What it does

- Searches for addresses in North Carolina and South Carolina.
- Uses Mecklenburg County parcel boundaries when the selected address is in Mecklenburg County, NC.
- Uses Mecklenburg/Charlotte aerial imagery for closer zoom in Mecklenburg County.
- Uses Esri World Imagery as the broader NC/SC basemap.
- Lets users draw garden beds, trees, fences, buildings, sheds, and other shade blockers.
- Estimates shadow direction by month and hour.
- Estimates direct sun hours across common garden dates.

## Current prototype behavior

- Address lookup tries ArcGIS World Geocoding first.
- U.S. Census Geocoder is used as a fallback.
- Mecklenburg County parcel lookup is enhanced through the Charlotte/Mecklenburg ArcGIS REST parcel service.
- Outside Mecklenburg County, users can still search, zoom, draw manually, and estimate sunlight, but parcel boundaries are not loaded yet.

## Privacy note

This prototype does not save user addresses, locations, or yard drawings to a database. Drawings exist only in the browser session unless future save/export features are added.

## Accuracy note

Sunflower estimates sunlight using map data and user edits. It cannot automatically know recent tree removals, fence height, pruning, leaf density, or neighboring changes unless the user adds them.

Always verify sunlight before planting.

## Run locally

From this folder:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Data and libraries

- Leaflet for map rendering
- Leaflet Draw for drawing/editing
- Turf.js for spatial calculations
- SunCalc for sun angle estimates
- ArcGIS World Geocoding for primary address search
- U.S. Census Geocoder fallback
- Esri World Imagery for broad basemap coverage
- Charlotte/Mecklenburg GIS aerial imagery for Mecklenburg close-zoom basemap
- Charlotte/Mecklenburg GIS parcel service for Mecklenburg parcel lookup

## Brand direction

This version uses the FARM127 brand guidance more directly:

- Uses the uploaded FARM127 sunflower icon asset in the primary header moment.
- Uses the brand palette: Sunflower Gold, Deep Soil Brown, Cream Field, Olive Stem, Clay, Sky Wash, Charcoal Brown, and Warm Gray.
- Uses Fraunces for headlines and Source Sans 3 for interface/body copy through Google Fonts.
- Keeps the sunflower restrained and avoids rebuilding the logo from CSS pieces.
- Keeps the voice warm, direct, practical, and grounded.

## Suggested next steps before public sharing

- Add NC and SC parcel services county-by-county or through state parcel sources if available.
- Add tree canopy overlays where reliable local datasets exist.
- Add building footprint auto-load where available.
- Add an export/share report.
- Add a clear feedback channel and issue tracker.
