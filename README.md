# Weather App JS

A mobile-style weather application built with vanilla HTML, CSS, and JavaScript. No frameworks or build tools required — just three files.

---

## Files

| File | Role |
|---|---|
| `weather_index.html` | App structure and screens |
| `weather_style.css` | All styling and animations |
| `weather_script.js` | All logic, API calls, canvas animations |

> **Important:** This is a three-file architecture. The files must never be merged into one.

---

## Features

- **Cities screen** — searchable list of saved cities displayed as color-coded cards
- **Detail screen** — full weather breakdown for a selected city with a live animated canvas background
- **Hourly forecast strip** — horizontally scrollable with temperature circles and weather icons
- **10-day forecast** — gradient temperature bars with high/low display
- **Detail stat cards** — humidity, wind, visibility, feels-like, dew point, UV, etc.
- **Unit modes** — Default (auto by country), Imperial (°F), Metric (°C), Hybrid (°C + mph)
- **Current location** — detects and adds the user's location via browser geolocation
- **Drag to reorder** — cities list supports drag-and-drop reordering in edit mode
- **Delete with confirmation** — swipe-to-reveal delete button with a modal confirmation dialog
- **Live canvas animations** — rain, snow, fog, thunderstorm, and clear-sky particle effects

---

## Weather Conditions

Mapped from Open-Meteo WMO weather codes:

| Category | Conditions |
|---|---|
| Clear / Cloudy | Clear, Mostly Clear, Partly Cloudy, Mostly Cloudy, Cloudy |
| Fog | Fog, Freezing Fog |
| Drizzle | Light Drizzle, Drizzle, Heavy Drizzle, Light Freezing Drizzle, Freezing Drizzle |
| Rain | Light Rain, Rain, Heavy Rain, Light Freezing Rain, Freezing Rain, Scattered Showers, Showers, Heavy Showers |
| Snow | Light Snow, Snow, Heavy Snow, Snow Flurries, Snow and Sleet, Heavy Snow and Sleet |
| Thunderstorm | Thunderstorm, Isolated Thunderstorm, Scattered Thunderstorms |

---

## Temperature Bands

Card background colors are driven by the current temperature in °F:

| Band | Range | Color |
|---|---|---|
| Bitter | ≤ −58°F | Dark Purple |
| Frigid | −57°F to 32°F | Violet |
| Cold | 33°F to 49°F | Blue |
| Chilly | 50°F to 59°F | Lime Green |
| Ideal | 60°F to 77°F | Yellow |
| Warm | 78°F to 94°F | Orange |
| Hot | 95°F to 121°F | Red |
| Scorched | ≥ 122°F | Maroon |

---

## Data Source

Weather data is fetched from the [Open-Meteo API](https://open-meteo.com/) — free, no API key required. City search uses the Open-Meteo Geocoding API.

---

## How to Run

1. Place all three files in the same folder
2. Open `weather_index.html` in a browser
3. Search for a city and add it to your list

No installation, no dependencies, no build step.

---

## Storage

Saved cities are persisted to `localStorage` under the key `weather_app_cities_v2`. Clearing browser storage resets the app to the default cities (New York, Los Angeles, Tokyo).
