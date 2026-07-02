// =========================================================
// STATE
// =========================================================
let isFahrenheit = true;
let unitMode = 'default';
let isHybrid = false;

// Advanced custom units (used when unitMode === 'advanced')
const ADVANCED_KEY = 'weather_app_advanced_v1';
let advancedUnits = { temp: 'F', wind: 'mph', precip: 'in', vis: 'mi', pressure: 'hpa' };
let savedCities = [];
let globalCache = {};
let currentCity = null;
let liveAnimFrame = null;
let liveParticles = [];
let liveAnimType = null;
let searchDebounce = null;
let dragSrcCity = null;
let editMode = false;

const STORAGE_KEY = 'weather_app_cities_v3';
const UNIT_KEY = 'weather_app_unit_v1';
const CACHE_KEY = 'weather_app_cache_v1';
const COORDS_KEY = 'weather_app_coords_v1';
let cityCoords = {};
const FAHRENHEIT_COUNTRIES = new Set([
  'US','BS','BZ','KY','PW','FM','MH','PR','GU','VI','AS','MP'
]);
const DEFAULT_CITIES = ['New York', 'Los Angeles', 'Tokyo', 'Paris', 'Toronto'];
const LOC_KEY = '__current_location__';

// =========================================================
// TEMPERATURE UTILS
// =========================================================
function tempCategory(f) {
  if (f <= 4)   return 'bitter';   // <= 4°F
  if (f <= 32)  return 'frigid';   // 5°F to 32°F
  if (f <= 49)  return 'cold';     // 33°F to 49°F
  if (f <= 59)  return 'chilly';   // 50°F to 59°F
  if (f <= 77)  return 'mild';     // 60°F to 77°F
  if (f <= 95)  return 'warm';     // 78°F to 95°F
  if (f <= 122) return 'hot';      // 96°F to 122°F
  return 'scorched';               // >= 123°F
}
const TEMP_COLORS = {
  bitter:'#32174d',  // Russian Violet <= 4°F
  frigid:'#8601af',  // Violet (RYB)  5°F to 32°F
  cold:  '#0000ff',  // Blue         33°F to 49°F
  chilly:'#00ff00',  // Lime         50°F to 59°F
  mild:  '#ffff00',  // Yellow       60°F to 77°F
  warm:  '#ffa500',  // Orange       78°F to 95°F
  hot:   '#ff0000',  // Red          96°F to 122°F
  scorched:'#800000',// Dark Red     >= 123°F
};
const TEMP_TEXT = {
  bitter:'#ffffff', frigid:'#ffffff', cold:'#ffffff', chilly:'#000000',
  mild:'#000000', warm:'#ffffff', hot:'#ffffff', scorched:'#ffffff'
};

// Zone START temperatures for gradient — each color begins at this °F value
const GRAD_BOUNDS = [
  { t: -58, hex: '#32174d' },  // Bitter:   <= 4°F
  { t:   5, hex: '#8601af' },  // Frigid:   5°F to 32°F
  { t:  33, hex: '#0000ff' },  // Cold:     33°F to 49°F
  { t:  50, hex: '#00ff00' },  // Chilly:   50°F to 59°F
  { t:  60, hex: '#ffff00' },  // Mild:    60°F to 77°F
  { t:  78, hex: '#ffa500' },  // Warm:     78°F to 95°F
  { t:  96, hex: '#ff0000' },  // Hot:      96°F to 122°F
  { t: 123, hex: '#800000' },  // Scorched: >= 123°F
];
function tempColor(f)     { return TEMP_COLORS[tempCategory(f)] || '#888'; }
function tempTextColor(f) { return TEMP_TEXT[tempCategory(f)] || '#fff'; }
function toDisplay(f) {
  var val;
  if (unitMode === 'advanced') val = advancedUnits.temp === 'F' ? Math.round(f) : Math.round((f-32)*5/9);
  else val = (isFahrenheit && !isHybrid) ? Math.round(f) : Math.round((f-32)*5/9);
  return val < 0 ? '\u2212' + Math.abs(val) : val;
}
function toDisplayStr(f)  { return toDisplay(f) + '\u00b0'; }

function displayWind(mph) {
  if (unitMode === 'advanced') {
    switch(advancedUnits.wind) {
      case 'kmh': return Math.round(mph * 1.60934) + ' km/h';
      case 'ms':  return (mph * 0.44704).toFixed(1) + ' m/s';
      case 'kn':  return Math.round(mph * 0.868976) + ' kn';
      default:    return mph + ' mph';
    }
  }
  return (!isHybrid && !isFahrenheit) ? Math.round(mph * 1.60934) + ' km/h' : mph + ' mph';
}
function displayPrecip(inches) {
  if (unitMode === 'advanced') {
    switch(advancedUnits.precip) {
      case 'mm': return (inches * 25.4).toFixed(1) + ' mm';
      case 'cm': return (inches * 2.54).toFixed(2) + ' cm';
      default:   return inches.toFixed(2) + ' in';
    }
  }
  return (!isHybrid && !isFahrenheit) ? (inches*2.54).toFixed(2) + ' cm' : inches.toFixed(2) + ' in';
}
function displayVis(meters) {
  if (unitMode === 'advanced') {
    switch(advancedUnits.vis) {
      case 'km': return (meters/1000).toFixed(1) + ' km';
      case 'm':  return Math.round(meters) + ' m';
      default:   return (meters/1609.34).toFixed(1) + ' mi';
    }
  }
  return (!isHybrid && !isFahrenheit) ? (meters/1000).toFixed(1) + ' km' : (meters/1609.34).toFixed(1) + ' mi';
}
function displayPressure(hpa) {
  if (unitMode !== 'advanced') return null; // not shown in non-advanced modes
  switch(advancedUnits.pressure) {
    case 'inhg': return (hpa * 0.02953).toFixed(2) + ' inHg';
    case 'mb':   return Math.round(hpa) + ' mb';
    case 'mmhg': return Math.round(hpa * 0.750062) + ' mmHg';
    default:     return Math.round(hpa) + ' hPa';
  }
}

// =========================================================
// WEATHER UTILS
// =========================================================
function decodeCode(code) {
  if (code === 0)  return 'Clear';
  if (code === 1)  return 'Mostly Clear';
  if (code === 2)  return 'Partly Cloudy';
  if (code === 3)  return 'Mostly Cloudy';
  if (code === 45) return 'Fog';
  if (code === 48) return 'Freezing Fog';
  if (code === 51) return 'Light Drizzle';
  if (code === 53) return 'Drizzle';
  if (code === 55) return 'Heavy Drizzle';
  if (code === 56) return 'Light Freezing Drizzle';
  if (code === 57) return 'Freezing Drizzle';
  if (code === 61) return 'Light Rain';
  if (code === 63) return 'Rain';
  if (code === 65) return 'Heavy Rain';
  if (code === 66) return 'Light Freezing Rain';
  if (code === 67) return 'Freezing Rain';
  if (code === 71) return 'Light Snow';
  if (code === 73) return 'Snow';
  if (code === 75) return 'Heavy Snow';
  if (code === 77) return 'Snow Flurries';
  if (code === 80) return 'Scattered Showers';
  if (code === 81) return 'Showers';
  if (code === 82) return 'Heavy Showers';
  if (code === 85) return 'Snow and Sleet';
  if (code === 86) return 'Heavy Snow and Sleet';
  if (code === 95) return 'Thunderstorm';
  if (code === 96) return 'Isolated Thunderstorm';
  if (code === 99) return 'Scattered Thunderstorms';
  return 'Cloudy';
}
function getIcon(condition, isDay) {
  const c = condition.toLowerCase();

  if (c === 'scattered thunderstorms')
    return '<span class="wi-white">&#9928;</span>';

  if (c === 'isolated thunderstorm')
    return isDay
      ? '<span class="wi-white">&#127785;</span>'
      : '<span class="wi-white">&#9928;</span>';

  if (c.includes('thunder'))
    return '<span class="wi-white">&#9928;</span>';

  if (c.includes('snow and sleet') || c.includes('heavy snow and sleet'))
    return '<span class="wi-white">&#127784;</span>';

  if (c.includes('heavy snow') || c.includes('blizzard'))
    return '<span class="wi-white">&#10052;</span>';

  if (c.includes('snow flurr') || c.includes('light snow'))
    return isDay
      ? '<span class="wi-white">&#127783;</span>'
      : '<span class="wi-white">&#10052;</span>';

  if (c.includes('snow'))
    return '<span class="wi-white">&#10052;</span>';

  if (c.includes('freezing'))
    return '<span class="wi-white">&#127767;</span>';

  if (c === 'heavy showers' || c.includes('heavy rain'))
    return '<span class="wi-white">&#127327;</span>';

  if (c === 'scattered showers')
    return isDay
      ? '<span class="wi-white">&#127783;</span>'
      : '<span class="wi-white">&#127783;</span>';

  if (c.includes('light rain') || c.includes('drizzle') || c === 'showers')
    return isDay
      ? '<span class="wi-white">&#127783;</span>'
      : '<span class="wi-white">&#127783;</span>';

  if (c.includes('shower') || c.includes('rain'))
    return '<span class="wi-white">&#9928;</span>';

  if (c === 'freezing fog' || c === 'fog')
    return '<span class="wi-white">&#127787;</span>';

  if (c.includes('fog') || c.includes('haze') || c.includes('mist'))
    return '<span class="wi-white">&#127787;</span>';

  if (c.includes('wind') || c.includes('breezy'))
    return '<span class="wi-white">&#127788;</span>';

  if (c.includes('mostly cloudy') || c.includes('overcast') || c.includes('cloudy'))
    return '<span class="wi-white">&#9729;</span>';

  if (c.includes('partly cloudy') || c.includes('mostly clear'))
    return isDay
      ? '<span class="wi-white">&#9925;</span>'
      : '<span class="wi-white">&#127748;</span>';

  if (isDay)
    return '<span class="wi-sun">&#9728;</span>';

  return '<span class="wi-white">&#127771;</span>';
}
function isRainyCondition(cond) {
  const c = cond.toLowerCase();
  return c.includes('thunder') || c.includes('shower') ||
         (c.includes('rain') && !c.includes('drizzle'));
}
function isGrayCondition(cond) {
  const c = cond.toLowerCase();
  return c.includes('rain')||c.includes('drizzle')||c.includes('shower')||
         c.includes('thunder')||c.includes('fog')||c.includes('snow')||c.includes('sleet')||
         c.includes('overcast')||(c.includes('cloud')&&!c.includes('partly')&&!c.includes('mostly'));
}
function aqiStatus(v) {
  if (v<=50)  return {label:'Good',                   color:'#00ff00',text:'#000'};
  if (v<=100) return {label:'Moderate',               color:'#ffff00',text:'#000'};
  if (v<=150) return {label:'Unhealthy for Sensitive',color:'#FFA500',text:'#fff'};
  if (v<=200) return {label:'Unhealthy',              color:'#FF0000',text:'#fff'};
  if (v<=300) return {label:'Very Unhealthy',         color:'#8601af',text:'#fff'};
  return             {label:'Hazardous',              color:'#800000',text:'#fff'};
}
function uvStatus(v) {
  if (v<=0)  return {label:'N/A',      color:'#00ff00',text:'#000'};
  if (v<=2)  return {label:'Low',      color:'#00ff00',text:'#000'};
  if (v<=5)  return {label:'Moderate', color:'#ffff00',text:'#000'};
  if (v<=7)  return {label:'High',     color:'#FFA500',text:'#fff'};
  if (v<=10) return {label:'Very High',color:'#FF0000',text:'#fff'};
  return            {label:'Extreme',  color:'#8601af',text:'#fff'};
}

// =========================================================
// LIVE CITY TIME
// =========================================================
function getCityTimeStr(utcOffsetSeconds) {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const cityMs = utcMs + (utcOffsetSeconds * 1000);
  const d = new Date(cityMs);
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m.toString().padStart(2,'0') + ' ' + ap;
}

// =========================================================
// API
// =========================================================
async function geocode(city) {
  const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=5&language=en&format=json');
  const d = await r.json();
  return d.results || [];
}
async function fetchWeatherData(lat, lon) {
  const r = await fetch(
    'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,wind_direction_10m,dew_point_2m,visibility,surface_pressure' +
    '&hourly=temperature_2m,weather_code,uv_index' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timeformat=iso8601&timezone=auto&forecast_days=10'
  );
  return r.json();
}
async function fetchAQI(lat, lon) {
  try {
    const r = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon + '&current=us_aqi');
    const d = await r.json();
    return (d && d.current && d.current.us_aqi) ? d.current.us_aqi : 0;
  } catch (e) { return 0; }
}
function compassDir(deg) {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];
}
function fmt12(iso) {
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m.toString().padStart(2,'0') + ' ' + ap;
}
function milHour(iso) {
  const d = new Date(iso);
  return d.getHours()*100 + d.getMinutes();
}
async function buildWeatherData(wx, aqi) {
  const cur    = wx.current  || {};
  const daily  = wx.daily    || {};
  const hourly = wx.hourly   || { time: [], temperature_2m: [], weather_code: [], uv_index: [] };
  const sunriseArr = (daily.sunrise && daily.sunrise.length) ? daily.sunrise : null;
  const sunsetArr  = (daily.sunset  && daily.sunset.length)  ? daily.sunset  : null;
  const nowHour    = new Date().getHours();
  const sunriseInt = sunriseArr ? milHour(sunriseArr[0]) : 600;
  const sunsetInt  = sunsetArr  ? milHour(sunsetArr[0])  : 2000;
  const currentMilitary = cur.time ? milHour(cur.time+':00') : nowHour * 100;
  const isDay = currentMilitary >= sunriseInt && currentMilitary < sunsetInt;
  const utcOffsetSeconds = wx.utc_offset_seconds || 0;
  // Find the index matching the current hour in the API's hourly array.
  // The API returns hourly data in the city's LOCAL timezone starting from
  // day 0 hour 0. We match by finding the entry whose datetime is closest
  // to now, then take 24 consecutive entries forward from there.
  const nowHourVal = Math.floor(currentMilitary / 100);
  let startIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < hourly.time.length; i++) {
    const parts = hourly.time[i].split('T');
    const hh = parseInt(parts[1].split(':')[0], 10);
    const dateStr = parts[0];
    // Only consider today's date entries first
    // cur.time is like "2024-03-16T14:00" — extract just the date
    const curDate = cur.time ? cur.time.split('T')[0] : '';
    if (dateStr === curDate) {
      const diff = Math.abs(hh - nowHourVal);
      if (diff < bestDiff) { bestDiff = diff; startIdx = i; }
    }
  }
  // Take exactly 24 hours starting from current hour
  const hourlyData = [];
  for (let i = startIdx; i < Math.min(startIdx + 24, hourly.time.length); i++) {
    const timeStr = hourly.time[i].split('T')[1];
    const hh = parseInt(timeStr.split(':')[0], 10);
    const mm = parseInt(timeStr.split(':')[1], 10);
    const timeMil = hh * 100 + mm;
    var hTemp = hourly.temperature_2m[i];
    if (hTemp == null) continue;   // skip hours with no data rather than show 0 or garbage
    hourlyData.push({
      time: timeMil,
      temp: Math.round(hTemp),
      condition: decodeCode(hourly.weather_code[i] != null ? hourly.weather_code[i] : 0),
      uvIndex: hourly.uv_index[i] || 0
    });
  }
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dailyTime = daily.time || [];
  const forecast = dailyTime.map(function(t, i) {
    return {
      day: i === 0 ? 'Today' : dayNames[new Date(t+'T12:00').getDay()],
      min: Math.round((daily.temperature_2m_min && daily.temperature_2m_min[i] != null) ? daily.temperature_2m_min[i] : 0),
      max: Math.round((daily.temperature_2m_max && daily.temperature_2m_max[i] != null) ? daily.temperature_2m_max[i] : 0),
      condition: decodeCode((daily.weather_code && daily.weather_code[i] != null) ? daily.weather_code[i] : 0)
    };
  });
  const uvMatch = hourlyData.find(function(h) { return Math.abs(h.time - currentMilitary) < 100; });
  const uvNow = uvMatch ? uvMatch.uvIndex : 0;
  return {
    currentTemp: Math.round(cur.temperature_2m    != null ? cur.temperature_2m    : 0),
    feelsLike:   Math.round(cur.apparent_temperature != null ? cur.apparent_temperature : 0),
    condition: decodeCode(cur.weather_code != null ? cur.weather_code : 0),
    isDay, sunriseInt, sunsetInt, currentMilitary,
    sunrise: sunriseArr ? fmt12(sunriseArr[0]) : '--',
    sunset:  sunsetArr  ? fmt12(sunsetArr[0])  : '--',
    humidity:  cur.relative_humidity_2m   != null ? cur.relative_humidity_2m   : 0,
    windSpeed: Math.round(cur.wind_speed_10m  != null ? cur.wind_speed_10m  : 0),
    windDir:   compassDir(cur.wind_direction_10m != null ? cur.wind_direction_10m : 0),
    dewPoint:  Math.round(cur.dew_point_2m    != null ? cur.dew_point_2m    : 50),
    uvIndex: Math.round(uvNow),
    airQuality: aqi,
    precipitation: (daily.precipitation_sum && daily.precipitation_sum[0]) ? daily.precipitation_sum[0] : 0,
    visibility: cur.visibility != null ? cur.visibility : 10000,
    pressure: cur.surface_pressure != null ? cur.surface_pressure : null,
    forecast, hourly: hourlyData, utcOffsetSeconds
  };
}
var WEATHER_TTL = 5 * 60 * 1000; // 5 minutes

async function getWeatherForCity(cityName) {
  var cached = globalCache[cityName];
  if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt) < WEATHER_TTL) {
    return cached;
  }
  var lat, lon;
  if (cityCoords[cityName]) {
    lat = cityCoords[cityName].lat;
    lon = cityCoords[cityName].lon;
  } else {
    const results = await geocode(cityName);
    if (!results.length) throw new Error('City not found: ' + cityName);
    lat = results[0].latitude;
    lon = results[0].longitude;
    cityCoords[cityName] = { lat: lat, lon: lon };
    storageSet(COORDS_KEY, JSON.stringify(cityCoords));
  }
  var wx = null, aqi = 0;
  try {
    var results2 = await Promise.all([fetchWeatherData(lat, lon), fetchAQI(lat, lon)]);
    wx  = results2[0];
    aqi = results2[1];
  } catch(e) {}

  // If API failed or returned an error, reuse last good cached data if available,
  // otherwise build a minimal fallback so the UI shows something.
  var apiOk = wx && wx.current && !wx.error;
  var data;
  if (apiOk) {
    data = await buildWeatherData(wx, aqi);
  } else {
    var reason = wx && wx.reason ? wx.reason : 'API unavailable';
    console.warn('Weather API fallback for ' + cityName + ': ' + reason);
    // Prefer last good cached data over a fake placeholder
    var lastGood = globalCache[cityName];
    if (lastGood && lastGood.currentTemp != null && !lastGood.isFallback) {
      data = Object.assign({}, lastGood);
    } else {
      data = await buildWeatherData({}, 0);
    }
    data.isFallback = true;
  }
  data.lat = lat;
  data.lon = lon;
  data.fetchedAt = apiOk ? Date.now() : 0;  // 0 = retry next time
  globalCache[cityName] = data;
  if (apiOk) {
    try {
      const wc = JSON.parse(storageGet(CACHE_KEY) || '{}');
      wc[cityName] = data;
      storageSet(CACHE_KEY, JSON.stringify(wc));
    } catch(e) {}
  }
  return data;
}

// =========================================================
// CURRENT LOCATION
// =========================================================
// Shared helper — silently updates location if already saved, or adds it fresh
async function _doLocationUpdate(silent) {
  if (!navigator.geolocation) {
    if (!silent) alert('Geolocation is not supported by your browser.');
    return;
  }
  return new Promise(function(resolve) {
    navigator.geolocation.getCurrentPosition(
      async function(pos) {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const r = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json');
          const d = await r.json();
          const city = d.address.city || d.address.town || d.address.village || d.address.county || 'My Location';
          const countryCode = (d.address.country_code || '').toUpperCase();
          if (unitMode === 'default') { isFahrenheit = FAHRENHEIT_COUNTRIES.has(countryCode); updateChecks(); }
          const prevCity = storageGet(LOC_KEY);
          if (prevCity && prevCity !== city) {
            savedCities = savedCities.filter(function(c) { return c !== prevCity; });
            delete globalCache[prevCity];
          }
          storageSet(LOC_KEY, city);
          const [wx, aqi] = await Promise.all([fetchWeatherData(lat, lon), fetchAQI(lat, lon)]);
          const locData = await buildWeatherData(wx, aqi);
          locData.lat = lat; locData.lon = lon;
          globalCache[city] = locData;
          var locDupe = savedCities.find(function(c) {
            if (c.toLowerCase() !== city.toLowerCase()) return false;
            var existing = cityCoords[c];
            if (!existing) return true;
            return Math.abs(existing.lat - lat) < 0.1 && Math.abs(existing.lon - lon) < 0.1;
          });
          if (locDupe) {
            savedCities = savedCities.filter(function(c) { return c !== locDupe; });
            savedCities.unshift(locDupe);
            globalCache[locDupe] = locData;
            storageSet(LOC_KEY, locDupe);
          } else {
            if (!savedCities.includes(city)) savedCities.unshift(city);
          }
          saveCities();
          renderCitiesScreen();
        } catch(e) { if (!silent) alert('Could not get weather for your location. Please try again.'); }
        resolve();
      },
      function() { if (!silent) alert('Location access was denied. Please allow location access and try again.'); resolve(); },
      { timeout: 10000 }
    );
  });
}

async function addCurrentLocation() {
  await _doLocationUpdate(false);
}

// =========================================================
// STORAGE
// =========================================================
function storageGet(key) {
  try { return localStorage.getItem(key); } catch(e) { return null; }
}
function storageSet(key, val) {
  try { localStorage.setItem(key, val); } catch(e) {}
}

function autoDetectUnit() {
  const IMPERIAL_COUNTRIES = new Set(['US','BS','BZ','KY','FM','MH','PR','GU','VI','AS','MP','LR']);
  const HYBRID_COUNTRIES = new Set(['GB']);
  const tzCountryMap = {
    'America/New_York':'US','America/Chicago':'US','America/Denver':'US','America/Los_Angeles':'US',
    'America/Anchorage':'US','America/Honolulu':'US','America/Phoenix':'US',
    'America/Indiana/Indianapolis':'US','America/Indiana/Chicago':'US','America/Indiana/Knox':'US',
    'America/Indiana/Marengo':'US','America/Indiana/Petersburg':'US','America/Indiana/Tell_City':'US',
    'America/Indiana/Vevay':'US','America/Indiana/Vincennes':'US','America/Indiana/Winamac':'US',
    'America/Detroit':'US','America/Kentucky/Louisville':'US','America/Kentucky/Monticello':'US',
    'America/North_Dakota/Beulah':'US','America/North_Dakota/Center':'US','America/North_Dakota/New_Salem':'US',
    'America/Boise':'US','America/Juneau':'US','America/Sitka':'US','America/Metlakatla':'US',
    'America/Yakutat':'US','America/Nome':'US','America/Adak':'US',
    'Pacific/Honolulu':'US','Pacific/Pago_Pago':'AS','Pacific/Guam':'GU',
    'America/Puerto_Rico':'PR',
    'America/Toronto':'CA','America/Vancouver':'CA','America/Edmonton':'CA',
    'America/Winnipeg':'CA','America/Halifax':'CA','America/St_Johns':'CA',
    'America/Regina':'CA','America/Whitehorse':'CA','America/Yellowknife':'CA',
    'America/Iqaluit':'CA','America/Moncton':'CA','America/Glace_Bay':'CA',
    'America/Goose_Bay':'CA','America/Nipigon':'CA','America/Rainy_River':'CA',
    'America/Rankin_Inlet':'CA','America/Resolute':'CA','America/Swift_Current':'CA',
    'America/Thunder_Bay':'CA','America/Cambridge_Bay':'CA','America/Inuvik':'CA',
    'Europe/London':'GB',
    'Europe/Dublin':'IE',
    'Europe/Paris':'FR','Europe/Berlin':'DE','Europe/Rome':'IT','Europe/Madrid':'ES',
    'Europe/Amsterdam':'NL','Europe/Brussels':'BE','Europe/Vienna':'AT',
    'Europe/Warsaw':'PL','Europe/Prague':'CZ','Europe/Budapest':'HU',
    'Europe/Bucharest':'RO','Europe/Sofia':'BG','Europe/Athens':'GR',
    'Europe/Helsinki':'FI','Europe/Stockholm':'SE','Europe/Oslo':'NO',
    'Europe/Copenhagen':'DK','Europe/Zurich':'CH','Europe/Lisbon':'PT',
    'Europe/Moscow':'RU','Europe/Kiev':'UA','Europe/Minsk':'BY',
    'Europe/Riga':'LV','Europe/Tallinn':'EE','Europe/Vilnius':'LT',
    'Europe/Istanbul':'TR',
    'Australia/Sydney':'AU','Australia/Melbourne':'AU','Australia/Brisbane':'AU',
    'Australia/Perth':'AU','Australia/Adelaide':'AU','Australia/Darwin':'AU',
    'Australia/Hobart':'AU','Australia/Lord_Howe':'AU','Australia/Eucla':'AU',
    'Australia/Broken_Hill':'AU','Australia/Lindeman':'AU',
    'Pacific/Auckland':'NZ','Pacific/Chatham':'NZ',
    'Africa/Monrovia':'LR',
    'Asia/Yangon':'MM',
    'Asia/Tokyo':'JP','Asia/Shanghai':'CN','Asia/Hong_Kong':'HK',
    'Asia/Seoul':'KR','Asia/Taipei':'TW','Asia/Singapore':'SG',
    'Asia/Kolkata':'IN','Asia/Karachi':'PK','Asia/Dhaka':'BD',
    'Asia/Bangkok':'TH','Asia/Jakarta':'ID','Asia/Manila':'PH',
    'Asia/Dubai':'AE','Asia/Riyadh':'SA','Asia/Tehran':'IR',
    'Asia/Baghdad':'IQ','Asia/Beirut':'LB','Asia/Jerusalem':'IL',
    'Asia/Almaty':'KZ','Asia/Tashkent':'UZ','Asia/Kabul':'AF',
    'Asia/Kathmandu':'NP','Asia/Colombo':'LK','Asia/Kuala_Lumpur':'MY',
    'America/Mexico_City':'MX','America/Cancun':'MX','America/Monterrey':'MX',
    'America/Bogota':'CO','America/Lima':'PE','America/Santiago':'CL',
    'America/Sao_Paulo':'BR','America/Buenos_Aires':'AR','America/Caracas':'VE',
    'America/La_Paz':'BO','America/Asuncion':'PY','America/Montevideo':'UY',
    'America/Guayaquil':'EC','America/Cayenne':'GF','America/Paramaribo':'SR',
    'America/Jamaica':'JM','America/Port-au-Prince':'HT','America/Santo_Domingo':'DO',
    'Africa/Lagos':'NG','Africa/Nairobi':'KE','Africa/Cairo':'EG',
    'Africa/Johannesburg':'ZA','Africa/Accra':'GH','Africa/Addis_Ababa':'ET',
    'Africa/Casablanca':'MA','Africa/Tunis':'TN','Africa/Algiers':'DZ',
    'Pacific/Fiji':'FJ','Pacific/Port_Moresby':'PG','Pacific/Noumea':'NC',
    'Pacific/Suva':'FJ','Pacific/Tongatapu':'TO','Pacific/Apia':'WS'
  };
  let countryCode = '';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    countryCode = tzCountryMap[tz] || '';
  } catch(e) {}
  if (IMPERIAL_COUNTRIES.has(countryCode)) {
    isFahrenheit = true; isHybrid = false;
  } else if (HYBRID_COUNTRIES.has(countryCode)) {
    isFahrenheit = false; isHybrid = true; unitMode = 'hybrid';
  } else {
    isFahrenheit = false; isHybrid = false;
  }
}

function loadCities() {
  try {
    var savedUnit = storageGet(UNIT_KEY);
    if (savedUnit && ['default','imperial','metric','hybrid','advanced'].includes(savedUnit)) {
      unitMode = savedUnit;
      if (savedUnit === 'advanced') {
        try { var au = JSON.parse(storageGet(ADVANCED_KEY) || 'null'); if (au) advancedUnits = Object.assign(advancedUnits, au); } catch(e) {}
        isFahrenheit = (advancedUnits.temp === 'F'); isHybrid = false;
      } else if (savedUnit !== 'default') { isHybrid=(savedUnit==='hybrid'); isFahrenheit=(savedUnit==='imperial'); }
    }
  } catch(e) {}
  if (unitMode === 'default') {
    autoDetectUnit();
  }
  try {
    const cc = storageGet(COORDS_KEY);
    if (cc) cityCoords = JSON.parse(cc);
  } catch(e) {}
  try {
    const s = storageGet(STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.length > 0) {
        savedCities = parsed;
        migrateOldCities();
        return;
      }
    }
  } catch (e) {}
  savedCities = DEFAULT_CITIES.slice();
  storageSet(STORAGE_KEY, JSON.stringify(savedCities));
}

function migrateOldCities() {
  var changed = false;
  var seen = {};
  var migrated = [];
  for (var i = 0; i < savedCities.length; i++) {
    var city = savedCities[i];
    var clean = city.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (clean !== city) changed = true;
    city = clean;
    if (city.indexOf(',') !== -1 && !cityCoords[city]) {
      var parts = city.split(',');
      var shortName = parts[0].trim();
      if (seen[shortName]) {
        migrated.push(city);
        migrateOneCity(city);
      } else {
        seen[shortName] = true;
        if (cityCoords[city]) {
          cityCoords[shortName] = cityCoords[city];
          delete cityCoords[city];
        }
        migrated.push(shortName);
        migrateOneCity(shortName);
        changed = true;
      }
    } else {
      seen[city] = true;
      migrated.push(city);
      if (!cityCoords[city]) {
        migrateOneCity(city);
      }
    }
  }
  if (changed) {
    savedCities = migrated;
    storageSet(STORAGE_KEY, JSON.stringify(savedCities));
    storageSet(COORDS_KEY, JSON.stringify(cityCoords));
  }
}

function migrateOneCity(cityName) {
  if (cityCoords[cityName]) return;
  geocode(cityName).then(function(results) {
    if (results.length && !cityCoords[cityName]) {
      cityCoords[cityName] = { lat: results[0].latitude, lon: results[0].longitude };
      storageSet(COORDS_KEY, JSON.stringify(cityCoords));
    }
  }).catch(function() {});
}
function saveCities() {
  storageSet(STORAGE_KEY, JSON.stringify(savedCities));
}
const CITY_LIMIT = 50;
function nonLocCityCount() {
  const locCity = storageGet(LOC_KEY);
  return savedCities.filter(function(c) { return c !== locCity; }).length;
}
function addCity(name, lat, lon) {
  if (!savedCities.some(function(c) { return c.toLowerCase() === name.toLowerCase(); })) {
    if (nonLocCityCount() >= CITY_LIMIT) return false;
    savedCities.push(name); saveCities();
  }
  if (lat != null && lon != null) {
    cityCoords[name] = { lat: lat, lon: lon };
    storageSet(COORDS_KEY, JSON.stringify(cityCoords));
  }
  return true;
}
function showDeleteConfirm(cityName, cardEl) {
  const modal = document.getElementById('delete-confirm-modal');
  const msg   = document.getElementById('delete-confirm-msg');
  const displayName = cityName.split(',')[0].trim();
  msg.textContent = 'Remove "' + displayName + '" from your cities?';

  const backdrop = document.getElementById('delete-confirm-backdrop');
  modal.classList.add('open');
  backdrop.classList.add('open');

  function closeModal() {
    modal.classList.remove('open');
    backdrop.classList.remove('open');
  }

  // Yes — delete and animate card out
  document.getElementById('delete-confirm-yes').onclick = function() {
    closeModal();
    removeCity(cityName);
    cardEl.style.opacity = '0';
    cardEl.style.transform = 'translateX(40px) scale(0.95)';
    cardEl.style.transition = 'all 0.22s ease';
    setTimeout(function() { cardEl.remove(); }, 230);
  };

  // No / Cancel — just close
  document.getElementById('delete-confirm-no').onclick = function() { closeModal(); };
  backdrop.onclick = function() { closeModal(); };
}

function removeCity(name) {
  savedCities = savedCities.filter(function(c) { return c !== name; });
  delete globalCache[name];
  delete cityCoords[name];
  storageSet(COORDS_KEY, JSON.stringify(cityCoords));
  saveCities();
}

// =========================================================
// LIVE CLOCK
// =========================================================
function startLiveClock() {
  setInterval(function() {
    document.querySelectorAll('.city-card[data-city]').forEach(function(card) {
      const data = globalCache[card.dataset.city];
      if (!data || data.utcOffsetSeconds == null) return;
      const timeEl = card.querySelector('.city-time');
      if (timeEl) timeEl.textContent = getCityTimeStr(data.utcOffsetSeconds);
    });
  }, 1000);
}

// =========================================================
// AUTO-REFRESH every 5 minutes
// =========================================================
// =========================================================
// SCREEN MANAGER
// =========================================================
function showScreen(id) {
  ['cities-screen', 'detail-screen', 'map-screen'].forEach(function(s) {
    document.getElementById(s).classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
}

// =========================================================
// CITIES SCREEN
// =========================================================
async function renderCitiesScreen() {
  // Only switch to cities screen if we're not on detail/map — avoids yanking user away
  var activeId = ['cities-screen','detail-screen','map-screen'].find(function(id) {
    return document.getElementById(id).classList.contains('active');
  });
  if (activeId !== 'detail-screen' && activeId !== 'map-screen') {
    showScreen('cities-screen');
  }
  // Sync menu button label with edit mode state
  syncEditModeUI();

  const list = document.getElementById('city-cards-list');
  list.innerHTML = '';

  if (savedCities.length === 0) {
    savedCities = DEFAULT_CITIES.slice();
    storageSet(STORAGE_KEY, JSON.stringify(savedCities));
  }

  for (let ci = 0; ci < savedCities.length; ci++) {
    (function(city) {
      const card = document.createElement('div');
      card.className = 'city-card';
      card.style.background = 'rgba(255,255,255,0.08)';
      card.dataset.city = city;
      card.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
      list.appendChild(card);

      const isLocCityDrag = city === storageGet(LOC_KEY);

      function renderCard(data) {
        const cat = tempCategory(data.currentTemp);
        const hi  = toDisplay(data.forecast[0] ? data.forecast[0].max : data.currentTemp);
        const lo  = toDisplay(data.forecast[0] ? data.forecast[0].min : data.currentTemp);
        const name = city.split(',')[0].trim();
        const isLocCity = city === storageGet(LOC_KEY);
        card.style.background = '';
        card.className = 'city-card card-' + cat + (editMode ? ' show-delete' : '');
        card.dataset.city = city;
        card.innerHTML =
          '<div class="card-top">' +
            '<div>' +
              '<div class="city-name">' + (isLocCity ? '&#128205; ' : '') + name + '</div>' +
              '<div class="city-time">' + getCityTimeStr(data.utcOffsetSeconds) + '</div>' +
              '<div class="city-condition">' + data.condition + '</div>' +
            '</div>' +
            '<div style="text-align:right">' +
              '<div class="city-temp">' + toDisplay(data.currentTemp) + '&deg;</div>' +
              '<div class="city-hilo">H:' + hi + '&deg; L:' + lo + '&deg;</div>' +
            '</div>' +
          '</div>' +
          (isLocCity ? '' : '<button class="delete-btn">&times;</button>') +
          (isLocCity ? '' : '<div class="drag-handle">&#9776;</div>');
        const delBtn = card.querySelector('.delete-btn');
        if (delBtn) delBtn.addEventListener('click', function(e) { e.stopPropagation(); showDeleteConfirm(city, card); });
        card.addEventListener('click', function(e) { if (editMode) return; if (!e.target.classList.contains('delete-btn') && !e.target.classList.contains('drag-handle')) showDetail(city); });
        // Subtle offline indicator when showing fallback data
        if (data.isFallback) {
          var badge = document.createElement('div');
          var badgeColor = tempTextColor(data.currentTemp); // black on lime/yellow, white elsewhere
          badge.style.cssText = 'position:absolute;bottom:8px;left:18px;font-size:10px;opacity:0.6;color:' + badgeColor + ';font-family:Roboto,sans-serif;';
          badge.textContent = 'Offline — showing estimate';
          card.appendChild(badge);
        }
      }

      // If already cached AND not a forced refresh — render instantly, then silently refresh in background.
      // If fetchedAt === 0 it was cleared by the Refresh action — show spinner and wait for real data.
      var cached = globalCache[city];
      if (cached && cached.fetchedAt !== 0) {
        renderCard(cached);
        getWeatherForCity(city).then(function(data) { renderCard(data); }).catch(function() {});
      } else {
        // Not cached — fetch and render when done
        getWeatherForCity(city).then(function(data) {
          renderCard(data);
        }).catch(function() {
          // Last resort — show an error card without fake temperature data
          renderCard({
            currentTemp: 0, feelsLike: 0, condition: 'Unavailable', isDay: true,
            forecast: [{max:0,min:0}], utcOffsetSeconds: 0, isFallback: true
          });
        });
      }

    })(savedCities[ci]);
  }
}

// Shared flag used by drag-scroll to suppress scroll during reorder
var touchDragCard = null;

// =========================================================
// CITIES + DETAIL SCREEN DRAG-TO-SCROLL
// =========================================================
(function() {
  function addDragScroll(el) {
    var startY = 0, startScroll = 0, isDragging = false, didDrag = false;
    el.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      if (e.target.closest('.drag-handle')) return;
      if (e.target.closest('input, button, select, textarea, a')) return;
      if (e.target.closest('.cities-top-bar, #search-results')) return;
      if (e.clientX > el.getBoundingClientRect().right - 15) return;
      isDragging = true; didDrag = false;
      startY = e.clientY;
      startScroll = el.scrollTop;
      el.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      if (Math.abs(e.clientY - startY) > 5) didDrag = true;
      el.scrollTop = startScroll - (e.clientY - startY);
    });
    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      el.style.cursor = '';
    });
    el.addEventListener('click', function(e) {
      if (didDrag) { e.stopPropagation(); didDrag = false; }
    }, true);
    el.addEventListener('touchstart', function(e) {
      if (e.target.closest('.drag-handle')) return;
      startY = e.touches[0].clientY;
      startScroll = el.scrollTop;
      didDrag = false;
    }, { passive: true });
    el.addEventListener('touchmove', function(e) {
      if (e.target.closest('.drag-handle')) return;
      if (touchDragCard) return;
      if (Math.abs(e.touches[0].clientY - startY) > 5) didDrag = true;
      el.scrollTop = startScroll - (e.touches[0].clientY - startY);
    }, { passive: true });
    el.addEventListener('touchend', function(e) {
      if (didDrag) e.preventDefault();
      setTimeout(function() { didDrag = false; }, 300);
    }, { passive: false });
  }
  addDragScroll(document.getElementById('cities-screen'));
  addDragScroll(document.getElementById('detail-screen'));

  // Horizontal drag-to-scroll for hourly strip
  (function() {
    var el, startX, startScroll, isDragging;
    document.addEventListener('mousedown', function(e) {
      var strip = e.target.closest('.hourly-scroll-wrap');
      if (!strip) return;
      if (e.button !== 0) return;
      el = strip; isDragging = true;
      startX = e.clientX; startScroll = el.scrollLeft;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging || !el) return;
      el.scrollLeft = startScroll - (e.clientX - startX);
    });
    document.addEventListener('mouseup', function() { isDragging = false; el = null; });
  })();
})();

// =========================================================
// UNIFIED POINTER DRAG REORDER (mouse + touch)
// =========================================================
(function() {
  var dragCity = null, dragCard = null, ghostEl = null;
  var startClientY = 0, ghostStartTop = 0;
  var edgeSize = 80, scrollRAF = null;
  var dragSrcIdx = -1, currentDropIdx = -1;

  function getScreen() { return document.getElementById('cities-screen'); }
  function getAllCards() { return Array.from(document.querySelectorAll('#city-cards-list .city-card')); }

  function applyShifts(dropIdx) {
    var cards = getAllCards();
    var cardH = dragCard.offsetHeight + 12;
    cards.forEach(function(c, i) {
      c.style.transition = 'transform 0.18s ease';
      if (c === dragCard) { c.style.transform = ''; return; }
      var shift = 0;
      if (dropIdx > dragSrcIdx) {
        if (i > dragSrcIdx && i <= dropIdx) shift = -cardH;
      } else if (dropIdx < dragSrcIdx) {
        if (i >= dropIdx && i < dragSrcIdx) shift = cardH;
      }
      c.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
    });
  }

  function clearShifts() {
    getAllCards().forEach(function(c) { c.style.transform = ''; c.style.transition = ''; });
  }

  function startDrag(card, clientY) {
    var cards = getAllCards();
    dragSrcIdx = cards.indexOf(card);
    currentDropIdx = dragSrcIdx;
    dragCity = card.dataset.city;
    dragCard = card;
    startClientY = clientY;
    touchDragCard = card;
    var rect = card.getBoundingClientRect();
    ghostStartTop = rect.top;
    ghostEl = card.cloneNode(true);
    ghostEl.style.cssText =
      'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;' +
      'width:' + rect.width + 'px;opacity:0.75;pointer-events:none;' +
      'z-index:9999;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    document.body.appendChild(ghostEl);
    card.style.opacity = '0';
  }

  function moveDrag(clientX, clientY) {
    if (!dragCard || !ghostEl) return;
    ghostEl.style.top = (ghostStartTop + (clientY - startClientY)) + 'px';

    // Auto-scroll near edges
    var screen = getScreen();
    var sRect = screen.getBoundingClientRect();
    var relY = clientY - sRect.top;
    if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
    if (relY < edgeSize) {
      var spd = Math.round(12 * (1 - relY / edgeSize));
      (function loop() { screen.scrollTop -= spd; scrollRAF = requestAnimationFrame(loop); })();
    } else if (relY > sRect.height - edgeSize) {
      var spd = Math.round(12 * (1 - (sRect.height - relY) / edgeSize));
      (function loop() { screen.scrollTop += spd; scrollRAF = requestAnimationFrame(loop); })();
    }

    // Find drop index: which card slot is ghost centre closest to
    var cards = getAllCards();
    var locCity = storageGet(LOC_KEY);
    var ghostMid = parseFloat(ghostEl.style.top) + dragCard.offsetHeight / 2;
    // ghostEl.style.top is fixed, convert to scroll-relative
    var scrollRelGhostMid = ghostMid - sRect.top + screen.scrollTop;

    var newDropIdx = dragSrcIdx;
    var bestDist = Infinity;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.city === locCity) continue;
      // Strip any applied translateY so we compare against natural slot positions
      var cRect = cards[i].getBoundingClientRect();
      var transformStr = cards[i].style.transform || '';
      var shiftMatch = transformStr.match(/translateY\((-?[\d.]+)px\)/);
      var appliedShift = shiftMatch ? parseFloat(shiftMatch[1]) : 0;
      var naturalMid = (cRect.top - appliedShift - sRect.top + screen.scrollTop) + cards[i].offsetHeight / 2;
      var dist = Math.abs(scrollRelGhostMid - naturalMid);
      if (dist < bestDist) { bestDist = dist; newDropIdx = i; }
    }

    if (newDropIdx !== currentDropIdx) {
      currentDropIdx = newDropIdx;
      applyShifts(currentDropIdx);
    }
  }

  function endDrag(clientX, clientY) {
    if (!dragCard) return;
    if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
    clearShifts();
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    dragCard.style.opacity = '';
    touchDragCard = null;

    if (currentDropIdx !== dragSrcIdx) {
      // currentDropIdx is a DOM card index; map to savedCities index via city name
      var cards = getAllCards();
      var targetCity = cards[currentDropIdx] && cards[currentDropIdx].dataset.city;
      var src = savedCities.indexOf(dragCity);
      var dst = targetCity ? savedCities.indexOf(targetCity) : -1;
      if (src !== -1 && dst !== -1) {
        var movingDown = currentDropIdx > dragSrcIdx;
        savedCities.splice(src, 1);
        dst = savedCities.indexOf(targetCity);
        if (movingDown) dst += 1; // drop after the target when moving down
        savedCities.splice(dst, 0, dragCity);
        saveCities();
        renderCitiesScreen();
      }
    }
    dragCity = null; dragCard = null; dragSrcIdx = -1; currentDropIdx = -1;
  }

  // Mouse
  document.addEventListener('mousedown', function(e) {
    if (!editMode) return;
    if (!e.target.closest('.drag-handle')) return;
    var card = e.target.closest('.city-card');
    if (!card) return;
    if (card.dataset.city === storageGet(LOC_KEY)) return;
    e.preventDefault();
    startDrag(card, e.clientY);
  });
  document.addEventListener('mousemove', function(e) { if (dragCard) moveDrag(e.clientX, e.clientY); });
  document.addEventListener('mouseup',   function(e) { if (dragCard) endDrag(e.clientX, e.clientY); });

  // Touch
  document.addEventListener('touchstart', function(e) {
    if (!editMode) return;
    if (!e.target.closest('.drag-handle')) return;
    var card = e.target.closest('.city-card');
    if (!card) return;
    if (card.dataset.city === storageGet(LOC_KEY)) return;
    e.preventDefault();
    startDrag(card, e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchmove', function(e) {
    if (!dragCard) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchend', function(e) {
    if (dragCard) endDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });
})();

// =========================================================
// SEARCH
// =========================================================
document.getElementById('city-search').addEventListener('input', function() {
  clearTimeout(searchDebounce);
  const val = this.value.trim();
  if (!val) { hideSearch(); return; }
  searchDebounce = setTimeout(async function() {
    const results = await geocode(val);
    const el = document.getElementById('search-results');
    if (!results.length) {
      el.innerHTML = '<div class="search-result-item">No results for "' + val + '"</div>';
    } else {
      el.innerHTML = results.slice(0,5).map(function(r, i) {
        const sub = [r.admin1, r.country].filter(Boolean).join(', ');
        var cleanName = r.name.replace(/\s*\(.*?\)\s*/g, '').trim();
        return '<div class="search-result-item" data-idx="' + i + '"><div>' + cleanName + '</div><div class="sub">' + sub + '</div></div>';
      }).join('');
      el.querySelectorAll('.search-result-item').forEach(function(item) {
        item.addEventListener('click', function() {
          const idx = parseInt(item.dataset.idx);
          const r = results[idx];
          if (r) {
            var displayName = r.name.replace(/\s*\(.*?\)\s*/g, '').trim();
            // Check if exact same city (same name + same coords within ~0.1 deg)
            // Skip the location service city — it's a separate pinned entry
            var _locCity = storageGet(LOC_KEY);
            var exactDupe = savedCities.some(function(c) {
              if (c === _locCity) return false; // never block manual add just because loc city has same name
              if (c.toLowerCase() !== displayName.toLowerCase()) return false;
              var existing = cityCoords[c];
              if (!existing) return true; // name match, no coords stored — treat as dupe
              return Math.abs(existing.lat - r.latitude) < 0.1 && Math.abs(existing.lon - r.longitude) < 0.1;
            });
            if (exactDupe) {
              var el2 = document.getElementById('search-results');
              el2.innerHTML = '<div class="search-result-item" style="color:#f87171;font-weight:500;">"' + displayName + '" is already in your cities.</div>';
              el2.classList.add('visible');
              return;
            }
            // Same name but different location — disambiguate with region
            if (savedCities.some(function(c) { return c.toLowerCase() === displayName.toLowerCase(); })) {
              var sub = [r.admin1, r.country].filter(Boolean).join(', ');
              displayName = displayName + (sub ? ', ' + sub : '');
            }
            if (nonLocCityCount() >= CITY_LIMIT) {
              var el2 = document.getElementById('search-results');
              el2.innerHTML = '<div class="search-result-item" style="color:#f87171;font-weight:500;">City limit reached (50 max). Remove a city to add a new one.</div>';
              el2.classList.add('visible');
              return;
            }
            addCity(displayName, r.latitude, r.longitude);
            document.getElementById('city-search').value = '';
            hideSearch();
            renderCitiesScreen();
          }
        });
      });
    }
    el.classList.add('visible');
  }, 400);
});
document.getElementById('city-search').addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { this.value = ''; hideSearch(true); }
});
function hideSearch(force) {
  const el = document.getElementById('search-results');
  // Don't immediately clear if showing an error message — let user read it
  if (!force && el.querySelector('[style*="f87171"]')) {
    setTimeout(function() { el.classList.remove('visible'); el.innerHTML = ''; }, 2500);
    return;
  }
  el.classList.remove('visible');
  el.innerHTML = '';
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.search-bar') && !e.target.closest('#search-results')) hideSearch();
});

// =========================================================
// DETAIL SCREEN
// =========================================================
async function showDetail(city) {
  citiesScrollY = document.getElementById('cities-screen').scrollTop;
  var ds = document.getElementById('detail-screen');
  ds.scrollTop = 0;
  showScreen('detail-screen');
  ds.scrollTop = 0;
  currentCity = city;
  document.getElementById('detail-city').textContent = city.split(',')[0].trim();
  document.getElementById('detail-temp').textContent = '';
  document.getElementById('detail-circle').style.backgroundColor = 'rgba(255,255,255,0.15)';
  document.getElementById('detail-circle').innerHTML = '<div class="spinner"></div>';
  document.getElementById('detail-icon').innerHTML = '';
  document.getElementById('detail-condition').textContent = 'Loading…';
  document.getElementById('hourly-inner').innerHTML = '';
  document.getElementById('forecast-rows').innerHTML = '';
  document.getElementById('detail-grid').innerHTML = '';
  setDetailBg('Clear', true, null, null, null);
  stopLiveAnim();
  try {
    const data = await getWeatherForCity(city);
    renderDetail(city, data);
  } catch (e) {
    // Last-resort fallback — getWeatherForCity shouldn't throw anymore but just in case
    console.error('showDetail error:', e);
    try {
      const fallback = await buildWeatherData({}, 0);
      fallback.lat = null; fallback.lon = null; fallback.isFallback = true;
      renderDetail(city, fallback);
    } catch(e2) {
      document.getElementById('detail-condition').textContent = 'Could not load weather data. Try again later.';
    }
  }
}
function renderDetail(city, data) {
  try {
    document.getElementById('detail-screen').scrollTop = 0;
    document.getElementById('detail-city').textContent = city.split(',')[0].trim();
    const circle = document.getElementById('detail-circle');
    circle.style.backgroundColor = tempColor(data.currentTemp);
    circle.innerHTML = '<span id="detail-temp"></span>';
    const tempEl = document.getElementById('detail-temp');
    tempEl.textContent = toDisplayStr(data.currentTemp);
    tempEl.style.color = tempTextColor(data.currentTemp);
    document.getElementById('detail-icon').innerHTML = getIcon(data.condition, data.isDay);
    document.getElementById('detail-condition').textContent = data.condition;
    setDetailBg(data.condition, data.isDay, data.currentMilitary, data.sunriseInt, data.sunsetInt);
    startLiveAnim(data.condition, data.isDay, data.currentMilitary, data.sunriseInt, data.sunsetInt);
    renderHourly(data);
    renderForecast(data);
    renderDetailGrid(data);
  } catch(e) {
    console.error('renderDetail error:', e);
    document.getElementById('detail-condition').textContent = 'Render error: ' + (e && e.message ? e.message : String(e));
  }
}
function setDetailBg(condition, isDay, currentMilitary, sunriseInt, sunsetInt) {
  const bg = document.getElementById('detail-bg');
  const c = condition.toLowerCase();
  let grad;

  // Time-of-day phase detection (within 60 min of sunrise/sunset = dawn/dusk)
  const TWILIGHT = 60;
  const isDawn = currentMilitary != null && sunriseInt != null &&
    currentMilitary >= sunriseInt - TWILIGHT && currentMilitary < sunriseInt + TWILIGHT;
  const isDusk = currentMilitary != null && sunsetInt != null &&
    currentMilitary >= sunsetInt - TWILIGHT && currentMilitary < sunsetInt + TWILIGHT;

  // Sky gradients
  const blueDay   = 'linear-gradient(180deg,#1462b8 0%,#1e8eee 35%,#48aef5 70%,#70c2f8 100%)';
  const blueNight = 'linear-gradient(180deg,#02050e 0%,#07101e 40%,#0c1a30 100%)';
  const dawnGrad  = 'linear-gradient(180deg,#0d1a3a 0%,#1a2a6c 20%,#b21f6e 55%,#f4874b 78%,#fcd06b 100%)';
  const duskGrad  = 'linear-gradient(180deg,#0d1020 0%,#1a1a4a 18%,#7b2260 45%,#e8683a 72%,#f9c36a 100%)';

  if (c === 'thunderstorm' || c === 'scattered thunderstorms') {
    grad = isDay
      ? 'linear-gradient(180deg,#191924 0%,#252535 60%,#202030 100%)'
      : 'linear-gradient(180deg,#06060c 0%,#100e18 100%)';
  } else if (c === 'isolated thunderstorm') {
    grad = isDay
      ? 'linear-gradient(180deg,#2a2a3a 0%,#3a3a50 50%,#2e2e42 100%)'
      : 'linear-gradient(180deg,#08080f 0%,#141228 100%)';
  } else if (c === 'snow and sleet' || c === 'heavy snow and sleet') {
    grad = isDay
      ? 'linear-gradient(180deg,#7a98b8 0%,#9ab0c8 50%,#b8c8dc 100%)'
      : 'linear-gradient(180deg,#141e2c 0%,#1e2c3c 100%)';
  } else if (c.includes('rain') || c.includes('drizzle') || c === 'scattered showers' || c === 'showers' || c === 'heavy showers') {
    grad = isDay
      ? 'linear-gradient(180deg,#48525e 0%,#58666e 45%,#68747e 100%)'
      : 'linear-gradient(180deg,#141820 0%,#1e2430 100%)';
  } else if (c.includes('snow')) {
    grad = isDay
      ? 'linear-gradient(180deg,#8aacc8 0%,#aec4d8 50%,#ccdaec 100%)'
      : 'linear-gradient(180deg,#141e2c 0%,#1e2c3c 100%)';
  } else if (c.includes('fog') || c.includes('mist') || c.includes('haze')) {
    grad = isDay
      ? 'linear-gradient(180deg,#8898a8 0%,#a8b8c4 50%,#c8d4dc 100%)'
      : 'linear-gradient(180deg,#262a30 0%,#363a42 100%)';
  } else if (c === 'overcast') {
    grad = isDay
      ? 'linear-gradient(180deg,#525c68 0%,#636e7a 50%,#727e8a 100%)'
      : 'linear-gradient(180deg,#181c24 0%,#222630 100%)';
  } else {
    // Clear/partly/mostly cloudy — use dawn/dusk if in twilight window, else day/night
    if (isDawn)      grad = dawnGrad;
    else if (isDusk) grad = duskGrad;
    else             grad = isDay ? blueDay : blueNight;
  }
  bg.style.background = grad;
}

// =========================================================
// HOURLY
// =========================================================
function renderHourly(data) {
  const inner = document.getElementById('hourly-inner');
  inner.innerHTML = '';
  // Don't show hourly strip when on fallback data — no real hourly values available
  if (data.isFallback || !data.hourly || !data.hourly.length) {
    inner.innerHTML = '<div style="color:rgba(255,255,255,0.45);font-size:13px;padding:16px 8px;font-family:Roboto,sans-serif;">Hourly data unavailable</div>';
    return;
  }
  const sunriseHour = Math.floor(data.sunriseInt/100);
  const sunsetHour  = Math.floor(data.sunsetInt/100);
  const nowHour     = Math.floor(data.currentMilitary/100);
  let foundNow = false;
  for (let i = 0; i < data.hourly.length; i++) {
    const h = data.hourly[i];
    const hi = Math.floor(h.time/100);
    if (hi === sunriseHour) inner.appendChild(makeAstronomy('Sunrise', '<span class="wi-sun">&#9728;</span>', data.sunrise));
    if (hi === sunsetHour)  inner.appendChild(makeAstronomy('Sunset',  '<span style="color:#FFB347">&#9790;</span>', data.sunset));
    let label = fmtMil(h.time), hTemp = h.temp;
    if (!foundNow && hi === nowHour) { label = 'Now'; hTemp = data.currentTemp; foundNow = true; }
    const isHDay = h.time >= data.sunriseInt && h.time < data.sunsetInt;
    const item = document.createElement('div');
    item.className = 'hourly-item';
    item.innerHTML =
      '<div class="h-time' + (label==='Now' ? ' now' : '') + '">' + label + '</div>' +
      '<div class="h-icon">' + getIcon(h.condition, isHDay) + '</div>' +
      '<div class="h-circle" style="background:' + tempColor(hTemp) + '">' +
        '<span style="color:' + tempTextColor(hTemp) + '">' + toDisplayStr(hTemp) + '</span>' +
      '</div>';
    inner.appendChild(item);
  }
}
function makeAstronomy(label, icon, time) {
  const el = document.createElement('div');
  el.className = 'astronomy-item';
  el.innerHTML = '<div class="a-time">' + time + '</div><div class="a-icon">' + icon + '</div><div class="a-label">' + label + '</div>';
  return el;
}
function fmtMil(mil) {
  if (mil === 0) return '12 AM';
  const h = Math.floor(mil/100), m = mil%100, ms = m.toString().padStart(2,'0');
  if (h < 12)   return h + ':' + ms + ' AM';
  if (h === 12) return '12:' + ms + ' PM';
  return (h-12) + ':' + ms + ' PM';
}

// =========================================================
// FORECAST
// =========================================================
function renderForecast(data) {
  const rows = document.getElementById('forecast-rows');
  rows.innerHTML = '';
  if (data.isFallback || !data.forecast || !data.forecast.length) {
    rows.innerHTML = '<div style="color:rgba(255,255,255,0.45);font-size:13px;padding:16px 8px;font-family:Roboto,sans-serif;">Forecast unavailable</div>';
    return;
  }
  for (let i = 0; i < data.forecast.length; i++) {
    const day = data.forecast[i];
    const row = document.createElement('div');
    row.className = 'forecast-row';
    const rawMin = day.min, rawMax = day.max, rawCur = data.currentTemp;
    const dMin = toDisplay(rawMin), dMax = toDisplay(rawMax);

    // Bar gradient spans exactly from rawMin to rawMax
    const gradient = makeGrad(rawMin, rawMax);

    // Dot for today only — position is % within [rawMin, rawMax]
    let dotHtml = '';
    if (i === 0) {
      const pct = Math.max(0, Math.min(100, ((rawCur - rawMin) / (rawMax - rawMin || 1)) * 100));
      dotHtml = '<div class="forecast-dot" style="left:calc(' + pct.toFixed(1) + '% - 4px);background:' + catColor(rawCur) + '"></div>';
    }

    row.innerHTML =
      '<div class="forecast-day">' + day.day + '</div>' +
      '<div class="forecast-low">' + dMin + '&deg;</div>' +
      '<div class="forecast-bar-wrap">' +
        '<div class="forecast-bar" style="background:' + gradient + '"></div>' +
        dotHtml +
      '</div>' +
      '<div class="forecast-high">' + dMax + '&deg;</div>';
    rows.appendChild(row);
  }
}
// GRAD_BOUNDS moved to top of file

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function lerpHex(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return 'rgb(' + Math.round(a[0]+(b[0]-a[0])*t) + ',' + Math.round(a[1]+(b[1]-a[1])*t) + ',' + Math.round(a[2]+(b[2]-a[2])*t) + ')';
}
function catColor(tempF) {
  let col = GRAD_BOUNDS[0].hex;
  for (let i = 0; i < GRAD_BOUNDS.length; i++) {
    if (tempF >= GRAD_BOUNDS[i].t) col = GRAD_BOUNDS[i].hex;
  }
  return col;
}
function makeGrad(min, max) {
  if (min >= max) { const c = tempColor(min); return 'linear-gradient(to right,' + c + ',' + c + ')'; }
  // Category boundary temperatures and their exact circle colors
  const BOUNDS = [
    { t: -58, hex: '#32174d' },
    { t:   5, hex: '#8601af' },
    { t:  33, hex: '#0000ff' },
    { t:  50, hex: '#00ff00' },
    { t:  60, hex: '#ffff00' },
    { t:  78, hex: '#ffa500' },
    { t:  96, hex: '#ff0000' },
    { t: 123, hex: '#800000' },
  ];
  // Collect only the boundary points that fall within [min, max], plus clamped endpoints
  const pts = [];
  // Start point — color of min
  pts.push({ t: min, hex: tempColor(min) });
  // Add any category boundaries strictly inside the range
  for (let i = 0; i < BOUNDS.length; i++) {
    if (BOUNDS[i].t > min && BOUNDS[i].t < max) {
      pts.push({ t: BOUNDS[i].t, hex: BOUNDS[i].hex });
    }
  }
  // End point — color of max
  pts.push({ t: max, hex: tempColor(max) });
  // Build stops as percentages across [min, max]
  const range = max - min;
  const stops = pts.map(function(p) {
    return p.hex + ' ' + (((p.t - min) / range) * 100).toFixed(1) + '%';
  });
  return 'linear-gradient(to right,' + stops.join(',') + ')';
}

// =========================================================
// DETAIL GRID
// =========================================================
function renderDetailGrid(data) {
  const grid = document.getElementById('detail-grid');
  grid.innerHTML = '';
  const aqi = aqiStatus(data.airQuality), uv = uvStatus(data.uvIndex);
  const precip = displayPrecip(data.precipitation);
  const vis    = displayVis(data.visibility);
  grid.appendChild(makeCircleCard('AIR QUALITY', data.airQuality, aqi.label, aqi.color, aqi.text));
  grid.appendChild(makeCircleCard('UV INDEX',    data.uvIndex,    uv.label,  uv.color,  uv.text));
  grid.appendChild(makeTextCard('PRECIPITATION', precip + '\n(24h)'));
  grid.appendChild(makeTextCard('VISIBILITY', vis));
  grid.appendChild(makeFeelsLikeCard(data.feelsLike, data.currentTemp, data.windSpeed, data.humidity));
  grid.appendChild(makeTextCard('HUMIDITY', data.humidity + '%'));
  grid.appendChild(makeTextCard('WIND', data.windDir + ' ' + displayWind(data.windSpeed)));
  grid.appendChild(makeTempCircleCard('DEW POINT', data.dewPoint));
  if (unitMode === 'advanced' && data.pressure != null) {
    grid.appendChild(makeTextCard('PRESSURE', displayPressure(data.pressure)));
  }
}
function makeCircleCard(title, value, label, circleColor, circleText) {
  const card = document.createElement('div');
  card.className = 'detail-card';
  card.innerHTML = '<div class="dc-title">' + title + '</div><div class="dc-circle-wrap"><div class="dc-circle" style="background:' + circleColor + '"><span style="color:' + circleText + '">' + value + '</span></div><div class="dc-circle-label">' + label + '</div></div>';
  return card;
}
function makeTempCircleCard(title, tempF) {
  const card = document.createElement('div');
  card.className = 'detail-card';
  card.innerHTML = '<div class="dc-title">' + title + '</div><div class="dc-circle-wrap"><div class="dc-circle" style="background:' + tempColor(tempF) + '"><span style="color:' + tempTextColor(tempF) + '">' + toDisplayStr(tempF) + '</span></div></div>';
  return card;
}
function makeFeelsLikeCard(feelsLikeF, actualF, windSpeed, humidity) {
  const diff = feelsLikeF - actualF;
  let reason = '';
  const cat = tempCategory(actualF);
  if (diff === 0) {
    reason = 'Similar to actual temperature (exact)';
  } else if (diff < 0) {
    reason = (cat === 'bitter' || cat === 'frigid')
      ? 'Wind makes it colder'
      : 'Wind makes it cooler';
  } else {
    reason = (cat === 'hot' || cat === 'scorched')
      ? 'Feels hotter than actual temperature'
      : 'Feels warmer than actual temperature';
  }
  const card = document.createElement('div');
  card.className = 'detail-card';
  card.innerHTML =
    '<div class="dc-title">FEELS LIKE</div>' +
    '<div class="dc-circle-wrap">' +
      '<div class="dc-circle" style="background:' + tempColor(feelsLikeF) + '">' +
        '<span style="color:' + tempTextColor(feelsLikeF) + '">' + toDisplayStr(feelsLikeF) + '</span>' +
      '</div>' +
      '<div class="dc-circle-label">' + reason + '</div>' +
    '</div>';
  return card;
}
function makeTextCard(title, value) {
  const card = document.createElement('div');
  card.className = 'detail-card';
  card.innerHTML = '<div class="dc-title">' + title + '</div><div class="dc-value" style="white-space:pre-line">' + value + '</div>';
  return card;
}

// =========================================================
// =========================================================
// CANVAS ANIMATION — photorealistic weather
// =========================================================
const canvas = document.getElementById('live-canvas');
const ctx = canvas.getContext('2d');
const W = 400, H = 900;

function stopLiveAnim() {
  if (liveAnimFrame) cancelAnimationFrame(liveAnimFrame);
  liveAnimFrame = null; liveParticles = []; liveAnimType = null;
  ctx.clearRect(0, 0, W, H);
}

function startLiveAnim(condition, isDay, currentMilitary, sunriseInt, sunsetInt) {
  stopLiveAnim();
  const c = condition.toLowerCase();

  if (c === 'thunderstorm' || c === 'scattered thunderstorms')
    { liveAnimType='thunder'; setupRain(false); setupClouds('dark', 9, currentMilitary, sunriseInt, sunsetInt); }

  else if (c === 'isolated thunderstorm')
    { liveAnimType='thunder'; setupRain(true);  setupClouds('dark', 6, currentMilitary, sunriseInt, sunsetInt); }

  else if (c === 'light drizzle')
    { liveAnimType='drizzle'; setupRain(true);  setupClouds('gray', 8, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'drizzle')
    { liveAnimType='drizzle'; setupRain(true);  setupClouds('gray', 8, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'heavy drizzle')
    { liveAnimType='drizzle'; setupRain(true);  setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }
  else if (c.includes('freezing drizzle'))
    { liveAnimType='drizzle'; setupRain(true);  setupClouds('gray', 8, currentMilitary, sunriseInt, sunsetInt); }

  else if (c === 'light rain')
    { liveAnimType='rain';    setupRain(false); setupClouds('gray', 8, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'rain')
    { liveAnimType='rain';    setupRain(false); setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'heavy rain')
    { liveAnimType='rain';    setupRain(false); setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }
  else if (c.includes('freezing rain'))
    { liveAnimType='rain';    setupRain(false); setupClouds('gray', 8, currentMilitary, sunriseInt, sunsetInt); }

  else if (c === 'scattered showers')
    { liveAnimType='rain';    setupRain(true);  setupClouds('gray', 6, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'showers')
    { liveAnimType='rain';    setupRain(false); setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'heavy showers')
    { liveAnimType='rain';    setupRain(false); setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }

  else if (c === 'snow and sleet' || c === 'heavy snow and sleet')
    { liveAnimType='snow';    setupSnow();      setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }

  else if (c === 'light snow')
    { liveAnimType='snow';    setupSnow();      setupClouds('gray', 8, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'snow')
    { liveAnimType='snow';    setupSnow();      setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'heavy snow')
    { liveAnimType='snow';    setupSnow();      setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }
  else if (c === 'snow flurries')
    { liveAnimType='snow';    setupSnow();      setupClouds('gray', 7, currentMilitary, sunriseInt, sunsetInt); }

  else if (c === 'fog' || c === 'freezing fog' || c.includes('fog') || c.includes('mist') || c.includes('haze'))
    { liveAnimType='fog';     setupFog(); }

  // === OVERCAST — solid gray ceiling, no sky visible ===
  else if (c === 'overcast')
    { liveAnimType='overcast'; setupClouds('gray', 9, currentMilitary, sunriseInt, sunsetInt); }

  // === MOSTLY CLOUDY — large white clouds dominating, blue sky peeking through ===
  else if (c === 'mostly cloudy')
    { liveAnimType='cloudy'; setupClouds(isDay?'white':'dark', 7, currentMilitary, sunriseInt, sunsetInt); }

  // === CLOUDY — several large white clouds, blue sky clearly visible ===
  else if (c === 'cloudy')
    { liveAnimType='cloudy';  setupClouds(isDay?'white':'dark', 5, currentMilitary, sunriseInt, sunsetInt); }

  // === PARTLY CLOUDY — a few large bright clouds on open blue sky ===
  else if (c === 'partly cloudy')
    { liveAnimType='cloudy';  setupClouds(isDay?'white':'dark', 3, currentMilitary, sunriseInt, sunsetInt); }

  // === MOSTLY CLEAR — one wispy cloud ===
  else if (c === 'mostly clear')
    { liveAnimType = isDay ? 'sunny' : 'night';
      isDay ? setupSun() : setupNight();
      setupClouds(isDay?'white':'dark', 1, currentMilitary, sunriseInt, sunsetInt); }

  // === CLEAR (code 0) ===
  else if (isDay)
    { liveAnimType='sunny';   setupSun(); }
  else
    { liveAnimType='night';   setupNight(); }

  var lastFlash = 0, flashAlpha = 0;
  var precipTint = 0;
  var precipTarget = liveAnimType === 'thunder' ? 0.38
                   : liveAnimType === 'rain'    ? 0.22
                   : liveAnimType === 'drizzle' ? 0.14
                   : liveAnimType === 'snow'    ? 0.10 : 0;

  function getPrecipTintColor() {
    if (liveAnimType === 'thunder')  return isDay ? '20,22,35'   : '8,8,16';
    if (liveAnimType === 'rain')     return isDay ? '38,48,62'   : '10,14,22';
    if (liveAnimType === 'drizzle')  return isDay ? '50,58,68'   : '12,16,24';
    if (liveAnimType === 'snow')     return isDay ? '180,195,215': '14,18,28';
    return '0,0,0';
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);

    // Smoothly ease tint toward target
    precipTint += (precipTarget - precipTint) * 0.018;

    // Precipitation tint overlay — drawn behind clouds
    if (precipTint > 0.005) {
      var col = getPrecipTintColor();
      var tg = ctx.createLinearGradient(0, 0, 0, H);
      tg.addColorStop(0,   'rgba('+col+','+(precipTint*0.55)+')');
      tg.addColorStop(0.4, 'rgba('+col+','+precipTint+')');
      tg.addColorStop(1,   'rgba('+col+','+(precipTint*0.75)+')');
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, W, H);
    }

    // Lightning flash
    if (liveAnimType === 'thunder') {
      var now = Date.now();
      if (now - lastFlash > 3000 + Math.random()*5000 && flashAlpha === 0) {
        lastFlash = now; flashAlpha = 0.40;
      }
      if (flashAlpha > 0) {
        ctx.fillStyle = 'rgba(255,255,245,'+flashAlpha+')';
        ctx.fillRect(0, 0, W, H);
        flashAlpha = Math.max(0, flashAlpha - 0.04);
      }
    }

    drawClouds();
    if (liveAnimType==='rain'||liveAnimType==='thunder') drawRain(false);
    if (liveAnimType==='drizzle')  drawRain(true);
    if (liveAnimType==='snow')     drawSnow();
    if (liveAnimType==='fog')      drawFog();
    if (liveAnimType==='sunny')    drawSun();
    if (liveAnimType==='night')    drawNight();
    liveAnimFrame = requestAnimationFrame(loop);
  }
  loop();
}

// ---- CLOUDS ----
// Photorealistic volumetric clouds matching Apple Weather style.
// Each cloud is drawn as layered overlapping puffs with light from top-left.
//
// style: 'white' = bright fluffy (clear/partly/mostly cloudy day)
//        'gray'  = flat gray overcast (rain/drizzle/overcast)
//        'dark'  = near-black storm (thunderstorm / night)
//
// count: 1=mostly clear, 3=partly cloudy, 5=cloudy, 7=mostly cloudy, 8+=overcast/rain

function drawCloudPuff(cx, cy, r, litR, litG, litB, shadR, shadG, shadB, alpha) {
  var g = ctx.createRadialGradient(
    cx - r*0.30, cy - r*0.32, r*0.04,
    cx,          cy,          r*1.05
  );
  g.addColorStop(0,   'rgba('+litR+','+litG+','+litB+','+alpha+')');
  g.addColorStop(0.55,'rgba('+litR+','+litG+','+litB+','+(alpha*0.88)+')');
  g.addColorStop(1,   'rgba('+shadR+','+shadG+','+shadB+','+(alpha*0.52)+')');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fill();
}

function drawCloudAt(cx, cy, w, h, style, alpha, currentMilitary, sunriseInt, sunsetInt) {
  // Color palettes
  var lR,lG,lB, mR,mG,mB, sR,sG,sB;
  if (style === 'white') {
    // Base: pure bright white midday — light and mid nearly white, shadow only slightly off-white
    lR=255; lG=255; lB=255;
    mR=248; mG=250; mB=252;
    sR=230; sG=234; sB=240;
    // Tint toward dawn/dusk warm orange-pink only — no gray at midday
    if (currentMilitary != null && sunriseInt != null && sunsetInt != null) {
      var TWILIGHT = 60;
      var dawnDist = Math.abs(currentMilitary - sunriseInt);
      var duskDist = Math.abs(currentMilitary - sunsetInt);
      var tDawn = Math.max(0, 1 - dawnDist / TWILIGHT);
      var tDusk = Math.max(0, 1 - duskDist / TWILIGHT);
      var tWarm = Math.max(tDawn, tDusk);
      if (tWarm > 0) {
        // Warm golden-pink tint at dawn/dusk
        lR=255; lG=Math.round(255-tWarm*55); lB=Math.round(255-tWarm*120);
        mR=Math.round(255-tWarm*10); mG=Math.round(220-tWarm*40); mB=Math.round(210-tWarm*100);
        sR=Math.round(230-tWarm*20); sG=Math.round(190-tWarm*35); sB=Math.round(200-tWarm*90);
      }
    }
  } else if (style === 'gray') {
    // Flat gray — overcast / rainy sky
    lR=195; lG=200; lB=210;
    mR=145; mG=152; mB=165;
    sR= 98; sG=105; sB=118;
  } else {
    // Dark storm / night clouds
    lR=105; lG=108; lB=118;
    mR= 68; mG= 72; mB= 82;
    sR= 40; sG= 43; sB= 52;
  }

  // ── Base slab (wide flat bottom) ──
  drawCloudPuff(cx,        cy+h*0.12, h*1.05, lR,lG,lB, sR,sG,sB, alpha);
  drawCloudPuff(cx-w*0.30, cy+h*0.20, h*0.85, mR,mG,mB, sR,sG,sB, alpha*0.95);
  drawCloudPuff(cx+w*0.30, cy+h*0.20, h*0.82, mR,mG,mB, sR,sG,sB, alpha*0.95);
  drawCloudPuff(cx-w*0.56, cy+h*0.26, h*0.62, mR,mG,mB, sR,sG,sB, alpha*0.88);
  drawCloudPuff(cx+w*0.56, cy+h*0.26, h*0.60, mR,mG,mB, sR,sG,sB, alpha*0.88);
  drawCloudPuff(cx-w*0.76, cy+h*0.32, h*0.44, sR,sG,sB, sR,sG,sB, alpha*0.75);
  drawCloudPuff(cx+w*0.76, cy+h*0.32, h*0.42, sR,sG,sB, sR,sG,sB, alpha*0.75);

  // ── Mid-level billowing bumps ──
  drawCloudPuff(cx-w*0.18, cy-h*0.52, h*0.96, lR,lG,lB, mR,mG,mB, alpha);
  drawCloudPuff(cx+w*0.12, cy-h*0.70, h*1.04, lR,lG,lB, mR,mG,mB, alpha);
  drawCloudPuff(cx+w*0.42, cy-h*0.40, h*0.82, mR,mG,mB, sR,sG,sB, alpha*0.95);
  drawCloudPuff(cx-w*0.44, cy-h*0.32, h*0.76, mR,mG,mB, sR,sG,sB, alpha*0.95);
  drawCloudPuff(cx+w*0.64, cy-h*0.18, h*0.58, mR,mG,mB, sR,sG,sB, alpha*0.88);
  drawCloudPuff(cx-w*0.64, cy-h*0.10, h*0.55, mR,mG,mB, sR,sG,sB, alpha*0.88);

  // ── Top crown peaks ──
  drawCloudPuff(cx+w*0.06, cy-h*1.28, h*0.72, lR,lG,lB, mR,mG,mB, alpha);
  drawCloudPuff(cx-w*0.22, cy-h*1.08, h*0.64, lR,lG,lB, mR,mG,mB, alpha*0.96);
  drawCloudPuff(cx+w*0.28, cy-h*1.02, h*0.58, lR,lG,lB, mR,mG,mB, alpha*0.94);
  drawCloudPuff(cx-w*0.04, cy-h*1.55, h*0.50, lR,lG,lB, mR,mG,mB, alpha*0.90);
}

function setupClouds(style, count, currentMilitary, sunriseInt, sunsetInt) {
  var dense = count >= 6;
  for (var i = 0; i < count; i++) {
    var w, h, yBase, yRange;
    if (dense) {
      // Mostly Cloudy / Overcast / Rain:
      // Very wide clouds packed into the top ~55% of the screen, overlapping to form a solid bank.
      // h*1.55 is the tallest puff above cy, so cy=180 + h*1.55 reaches down to ~360px (40% of 900).
      w      = 220 + Math.random() * 180;   // 220–400px wide
      h      =  80 + Math.random() *  55;   // 80–135px tall
      yBase  = 160;                          // start clouds here
      yRange =  80;                          // spread only 80px so they stay in upper band
    } else {
      // Partly Cloudy / Cloudy — a few individual clouds in the upper portion
      w      = 110 + Math.random() * 120;   // 110–230px wide
      h      =  50 + Math.random() *  42;   // 50–92px tall
      yBase  =  60;
      yRange = 200;
    }
    liveParticles.push({
      tag:   'cloud',
      x:     Math.random() * (W + 300) - 150,
      y:     yBase + Math.random() * yRange,
      w: w, h: h,
      vx:    0.04 + Math.random() * 0.10,
      style: style,
      alpha: dense ? 0.92 + Math.random()*0.07 : 0.78 + Math.random()*0.17,
      currentMilitary: currentMilitary, sunriseInt: sunriseInt, sunsetInt: sunsetInt
    });
  }
}

function drawClouds() {
  for (var i = 0; i < liveParticles.length; i++) {
    var p = liveParticles[i];
    if (p.tag !== 'cloud') continue;
    drawCloudAt(p.x, p.y, p.w, p.h, p.style, p.alpha, p.currentMilitary, p.sunriseInt, p.sunsetInt);
    p.x += p.vx;
    if (p.x > W + 280) p.x = -280;
  }
}

// ---- RAIN ----
function setupRain(drizzle) {
  var count = drizzle ? 80 : 160;
  for (var i=0;i<count;i++) {
    liveParticles.push({
      tag:'rain', x:Math.random()*W, y:Math.random()*H,
      len: drizzle ? 6+Math.random()*6 : 14+Math.random()*10,
      vy: drizzle ? 7+Math.random()*4 : 18+Math.random()*8,
      vx: drizzle ? -0.5 : -3,
      a: drizzle ? 0.25+Math.random()*0.2 : 0.45+Math.random()*0.3
    });
  }
}
function drawRain(drizzle) {
  ctx.save();
  ctx.lineCap = 'round';
  for (var i=0;i<liveParticles.length;i++) {
    var p=liveParticles[i];
    if(p.tag!=='rain') continue;
    // Gradient raindrop — lighter at top, fades at bottom
    var grad = ctx.createLinearGradient(p.x,p.y, p.x+p.vx*1.5, p.y+p.len);
    grad.addColorStop(0, 'rgba(200,225,255,0)');
    grad.addColorStop(1, 'rgba(200,225,255,'+p.a+')');
    ctx.strokeStyle = grad;
    ctx.lineWidth = drizzle ? 0.8 : 1.2;
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+p.vx*1.5, p.y+p.len); ctx.stroke();
    p.x+=p.vx; p.y+=p.vy;
    if(p.y>H){p.y=-20;p.x=Math.random()*W;}
    if(p.x<-10)p.x=W+10;
  }
  ctx.restore();
}

// ---- SNOW ----
function setupSnow() {
  for (var i=0;i<90;i++) {
    liveParticles.push({
      tag:'snow', x:Math.random()*W, y:Math.random()*H,
      r: 1.5+Math.random()*3, vy:0.5+Math.random()*0.9,
      phase:Math.random()*Math.PI*2, freq:0.3+Math.random()*0.5,
      a: 0.7+Math.random()*0.3
    });
  }
}
function drawSnow() {
  var t=Date.now()/2000;
  ctx.save();
  for (var i=0;i<liveParticles.length;i++) {
    var p=liveParticles[i];
    if(p.tag!=='snow') continue;
    // Each snowflake = white circle with a soft glow
    var g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*1.6);
    g.addColorStop(0,'rgba(255,255,255,'+p.a+')');
    g.addColorStop(1,'rgba(220,235,255,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*1.6,0,Math.PI*2); ctx.fill();
    p.y+=p.vy; p.x+=Math.sin(t*p.freq+p.phase)*0.8;
    if(p.y>H){p.y=-10;p.x=Math.random()*W;}
  }
  ctx.restore();
}

// ---- FOG ----
function setupFog() {
  for (var i=0;i<10;i++) {
    liveParticles.push({
      tag:'fog', x:Math.random()*(W+400)-200,
      y:120+Math.random()*600, w:180+Math.random()*200, h:35+Math.random()*35,
      vx:0.06+Math.random()*0.08, a:0.06+Math.random()*0.08
    });
  }
}
function drawFog() {
  ctx.save();
  for (var i=0;i<liveParticles.length;i++) {
    var p=liveParticles[i];
    if(p.tag!=='fog') continue;
    var g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.w);
    g.addColorStop(0,'rgba(215,220,228,'+p.a+')');
    g.addColorStop(1,'rgba(215,220,228,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.ellipse(p.x,p.y,p.w,p.h,0,0,Math.PI*2); ctx.fill();
    p.x+=p.vx; if(p.x>W+250)p.x=-250;
  }
  ctx.restore();
}

// ---- SUN ----
function setupSun() {
  liveParticles.push({tag:'sun', x:300, y:120, r:52});
}
function drawSun() {
  var p=liveParticles.find(function(x){return x.tag==='sun';});
  if(!p) return;
  var t=Date.now()/2000;
  ctx.save();

  // Atmospheric haze — wide soft glow behind the sun
  var haze=ctx.createRadialGradient(p.x,p.y,p.r,p.x,p.y,p.r*4.5);
  haze.addColorStop(0,'rgba(255,235,120,0.22)');
  haze.addColorStop(0.4,'rgba(255,200,60,0.08)');
  haze.addColorStop(1,'rgba(255,180,0,0)');
  ctx.fillStyle=haze; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*4.5,0,Math.PI*2); ctx.fill();

  // Rotating rays — slim tapered beams
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(t*0.07);
  for(var i=0;i<16;i++) {
    ctx.rotate(Math.PI*2/16);
    var rayLen=45+Math.sin(t*1.2+i)*12;
    var ray=ctx.createLinearGradient(p.r+2,0,p.r+2+rayLen,0);
    ray.addColorStop(0,'rgba(255,240,100,0.32)');
    ray.addColorStop(1,'rgba(255,210,50,0)');
    ctx.fillStyle=ray;
    ctx.beginPath();
    ctx.moveTo(p.r+2,-3); ctx.lineTo(p.r+2+rayLen,0); ctx.lineTo(p.r+2,3); ctx.fill();
  }
  ctx.restore();

  // Sun disc — bright center fading to warm edge
  var disc=ctx.createRadialGradient(p.x-p.r*0.25,p.y-p.r*0.25,0,p.x,p.y,p.r);
  disc.addColorStop(0,'rgba(255,255,230,1)');
  disc.addColorStop(0.6,'rgba(255,245,160,0.98)');
  disc.addColorStop(1,'rgba(255,220,60,0.90)');
  ctx.fillStyle=disc; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();

  ctx.restore();
}

// ---- NIGHT ----
function setupNight() {
  for(var i=0;i<75;i++) {
    liveParticles.push({
      tag:'star', x:Math.random()*W, y:Math.random()*(H*0.6),
      r:Math.random()<0.15?2.2:Math.random()<0.4?1.4:0.9,
      phase:Math.random()*Math.PI*2, speed:0.4+Math.random()*0.9
    });
  }
  liveParticles.push({tag:'moon', x:300, y:120, r:44});
}
function drawNight() {
  var t=Date.now()/1000;
  ctx.save();
  for(var i=0;i<liveParticles.length;i++) {
    var p=liveParticles[i];
    if(p.tag==='star') {
      var a=0.45+0.55*(0.5+0.5*Math.sin(t*p.speed+p.phase));
      // Bigger stars get a tiny cross flare
      if(p.r>1.8) {
        ctx.strokeStyle='rgba(255,255,255,'+(a*0.3)+')';
        ctx.lineWidth=0.5;
        ctx.beginPath(); ctx.moveTo(p.x-p.r*2,p.y); ctx.lineTo(p.x+p.r*2,p.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x,p.y-p.r*2); ctx.lineTo(p.x,p.y+p.r*2); ctx.stroke();
      }
      ctx.fillStyle='rgba(255,255,255,'+a+')';
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    else if(p.tag==='moon') {
      // Soft glow
      var glow=ctx.createRadialGradient(p.x,p.y,p.r*0.8,p.x,p.y,p.r*2.8);
      glow.addColorStop(0,'rgba(210,225,255,0.18)');
      glow.addColorStop(1,'rgba(160,185,255,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.8,0,Math.PI*2); ctx.fill();

      // Moon disc — slightly warm ivory
      ctx.fillStyle='rgba(245,248,255,0.97)';
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();

      // Shadow arc for crescent
      ctx.fillStyle='rgba(12,22,55,0.72)';
      ctx.beginPath(); ctx.arc(p.x+p.r*0.42,p.y,p.r*0.86,0,Math.PI*2); ctx.fill();

      // Subtle maria (dark patches)
      ctx.fillStyle='rgba(180,192,220,0.14)';
      ctx.beginPath(); ctx.ellipse(p.x-p.r*0.22,p.y+p.r*0.12,p.r*0.26,p.r*0.18,0.4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(p.x-p.r*0.05,p.y-p.r*0.28,p.r*0.18,p.r*0.13,-0.2,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}
// =========================================================
// MENU
// =========================================================
const menuBtn = document.getElementById('menuBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
document.addEventListener('click', function() { dropdownMenu.classList.remove('open'); });
dropdownMenu.addEventListener('click', function(e) { e.stopPropagation(); });

function syncEditModeUI() {
  const btn = document.getElementById('menuBtn');
  if (editMode) {
    btn.innerHTML = '&#10003; Done';
    btn.style.color = '#4fc3f7';
  } else {
    btn.innerHTML = '&#9776; Menu';
    btn.style.color = '';
  }
}

document.getElementById('menuRefresh').addEventListener('click', function() {
  dropdownMenu.classList.remove('open');
  Object.keys(globalCache).forEach(function(k) { globalCache[k].fetchedAt = 0; });
  renderCitiesScreen();
});
// Add City removed — search bar handles adding cities
document.getElementById('menuEditCities').addEventListener('click', function() {
  dropdownMenu.classList.remove('open');
  editMode = true;
  document.querySelectorAll('.city-card').forEach(function(c) { c.classList.add('show-delete'); });
  syncEditModeUI();
});
document.getElementById('menuCurrentLocation').addEventListener('click', function() {
  dropdownMenu.classList.remove('open');
  addCurrentLocation();
});
// Menu button: opens menu normally, acts as Done when in edit mode
document.getElementById('menuBtn').addEventListener('click', function(e) {
  if (editMode) {
    e.stopPropagation();
    editMode = false;
    document.querySelectorAll('.city-card').forEach(function(c) { c.classList.remove('show-delete'); });
    syncEditModeUI();
  } else {
    dropdownMenu.classList.toggle('open');
    e.stopPropagation();
  }
});

document.getElementById('menuDefault').addEventListener('click', function() { dropdownMenu.classList.remove('open'); applyUnit('default'); });
document.getElementById('menuImperial').addEventListener('click', function() { dropdownMenu.classList.remove('open'); applyUnit('imperial'); });
document.getElementById('menuMetric').addEventListener('click', function() { dropdownMenu.classList.remove('open'); applyUnit('metric'); });
document.getElementById('menuHybrid').addEventListener('click', function() { dropdownMenu.classList.remove('open'); applyUnit('hybrid'); });
document.getElementById('menuAdvanced').addEventListener('click', function() { dropdownMenu.classList.remove('open'); openAdvancedPanel(); });

function applyUnit(mode) {
  unitMode = mode;
  storageSet(UNIT_KEY, mode);
  if (mode === 'default') {
    autoDetectUnit();
  } else if (mode === 'advanced') {
    // keep isFahrenheit/isHybrid in sync with advancedUnits.temp for tempColor logic
    isFahrenheit = (advancedUnits.temp === 'F');
    isHybrid = false;
  } else {
    isHybrid = (mode === 'hybrid');
    isFahrenheit = (mode === 'imperial');
  }
  updateChecks();
  // Unit change — always force a fresh API fetch so data is current, not just re-converted.
  Object.keys(globalCache).forEach(function(k) { globalCache[k].fetchedAt = 0; });
  var detailActive = document.getElementById('detail-screen').classList.contains('active');
  if (detailActive && currentCity) {
    // Re-fetch and re-render the open detail view immediately, refresh city cards behind it
    getWeatherForCity(currentCity).then(function(data) {
      renderDetail(currentCity, data);
    }).catch(function() {});
    renderCitiesScreen();
  } else {
    renderCitiesScreen();
  }
}
function updateChecks() {
  ['menuDefault','menuImperial','menuMetric','menuHybrid','menuAdvanced'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.classList.remove('checked');
  });
  const map = {default:'menuDefault', imperial:'menuImperial', metric:'menuMetric', hybrid:'menuHybrid', advanced:'menuAdvanced'};
  var el = document.getElementById(map[unitMode]); if (el) el.classList.add('checked');
}

// ─── ADVANCED UNITS PANEL ─────────────────────────────────────────────────────
var advPanelListenersAttached = false;

function openAdvancedPanel() {
  // Load saved advanced units from storage
  try {
    var saved = JSON.parse(storageGet(ADVANCED_KEY) || 'null');
    if (saved) advancedUnits = Object.assign(advancedUnits, saved);
  } catch(e) {}
  syncAdvancedUI();
  document.getElementById('advanced-panel').classList.add('open');
  document.getElementById('advanced-backdrop').classList.add('open');

  // Attach listeners here — panel HTML is guaranteed to exist at this point
  if (!advPanelListenersAttached) {
    advPanelListenersAttached = true;

    // Segment button clicks — single select per group
    document.querySelectorAll('.adv-seg').forEach(function(seg) {
      seg.addEventListener('click', function(e) {
        var btn = e.target.closest('.adv-seg-btn');
        if (!btn) return;
        seg.querySelectorAll('.adv-seg-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var keyMap = { segTemp:'temp', segWind:'wind', segPrecip:'precip', segVis:'vis', segPressure:'pressure' };
        advancedUnits[keyMap[seg.id]] = btn.dataset.val;
      });
    });

    document.getElementById('advClose').addEventListener('click', closeAdvancedPanel);
    document.getElementById('advanced-backdrop').addEventListener('click', closeAdvancedPanel);
    document.getElementById('advApply').addEventListener('click', function() {
      storageSet(ADVANCED_KEY, JSON.stringify(advancedUnits));
      closeAdvancedPanel();
      applyUnit('advanced');
    });
  }
}

function closeAdvancedPanel() {
  document.getElementById('advanced-panel').classList.remove('open');
  document.getElementById('advanced-backdrop').classList.remove('open');
}

function syncAdvancedUI() {
  [
    { seg: 'segTemp',     key: 'temp' },
    { seg: 'segWind',     key: 'wind' },
    { seg: 'segPrecip',   key: 'precip' },
    { seg: 'segVis',      key: 'vis' },
    { seg: 'segPressure', key: 'pressure' },
  ].forEach(function(row) {
    var seg = document.getElementById(row.seg);
    if (!seg) return;
    seg.querySelectorAll('.adv-seg-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.val === advancedUnits[row.key]);
    });
  });
}

// =========================================================
// BACK BUTTON
// =========================================================
let citiesScrollY = 0;
let detailScrollY = 0;
document.getElementById('back-btn').addEventListener('click', function() {
  detailScrollY = 0;
  stopLiveAnim();
  currentCity = null;
  showScreen('cities-screen');
  // Restore cities scroll position
  requestAnimationFrame(function() {
    document.getElementById('cities-screen').scrollTop = citiesScrollY;
  });
});

// =========================================================
// MAP SCREEN
// =========================================================
let mapInstance = null;
let mapCurrentLayer = 'temp';
let mapOverlayLayer = null;
let mapCanvasLayer = null;
let mapCityMarkers = [];
let mapInitialized = false;
let mapPrevScreen = 'cities-screen';

// OpenWeatherMap free API key — sign up at openweathermap.org for your own
const OWM_KEY = '4b9e4b4e81cc1f2a8d5d3f7b2e9c1a0d';

// (aqiColor and aqiLabel defined earlier — see top of map section)

function buildTempLegend() {
  var unit = (isFahrenheit && !isHybrid) ? '°F' : '°C';
  var lo  = (isFahrenheit && !isHybrid) ? '-58°' : '-50°';
  var mid = (isFahrenheit && !isHybrid) ? '32°'  : '0°';
  var hi  = (isFahrenheit && !isHybrid) ? '123°' : '51°';
  var grad = 'linear-gradient(to right,#32174d 0%,#8601af 34.8%,#0000ff 50.3%,#00ff00 59.7%,#ffff00 65.2%,#ffa500 75.1%,#ff0000 85.1%,#800000 100%)';
  return '<div class="map-legend-title">Temperature (' + unit + ')</div>' +
    '<div class="map-legend-bar"><div class="map-legend-gradient" style="background:' + grad + '"></div></div>' +
    '<div class="map-legend-labels"><span class="map-legend-label">' + lo + '</span><span class="map-legend-label">' + mid + '</span><span class="map-legend-label">' + hi + '</span></div>';
}
function buildPrecipLegend() {
  return '<div class="map-legend-title">Precipitation (radar)</div>' +
    '<div class="map-legend-bar"><div class="map-legend-gradient" style="background:linear-gradient(to right,rgba(0,100,255,0.1),#0080ff,#00ffff,#00ff00,#ffff00,#ff8000,#ff0000)"></div></div>' +
    '<div class="map-legend-labels"><span class="map-legend-label">None</span><span class="map-legend-label">Moderate</span><span class="map-legend-label">Heavy</span></div>';
}
function buildAqiLegend() {
  return '<div class="map-legend-title">Air Quality Index</div><div class="map-legend-swatches">' +
    '<div class="map-legend-swatch"><div class="map-legend-dot" style="background:#00e400"></div><span>Good</span></div>' +
    '<div class="map-legend-swatch"><div class="map-legend-dot" style="background:#ffff00"></div><span>Moderate</span></div>' +
    '<div class="map-legend-swatch"><div class="map-legend-dot" style="background:#ff7e00"></div><span>Sensitive</span></div>' +
    '<div class="map-legend-swatch"><div class="map-legend-dot" style="background:#ff0000"></div><span>Unhealthy</span></div>' +
    '<div class="map-legend-swatch"><div class="map-legend-dot" style="background:#8f3f97"></div><span>Very Unhealthy</span></div>' +
    '<div class="map-legend-swatch"><div class="map-legend-dot" style="background:#7e0023"></div><span>Hazardous</span></div></div>';
}

function clearMapOverlays() {
  if (mapOverlayLayer) { mapInstance.removeLayer(mapOverlayLayer); mapOverlayLayer = null; }
  mapCityMarkers.forEach(function(m) { mapInstance.removeLayer(m); });
  mapCityMarkers = [];
}

function addCityPin(city, color, textColor, label, value, lat, lon) {
  var icon = L.divIcon({
    className: '',
    html: '<div class="map-pin-wrap">' +
            '<div class="map-pin-circle" style="background:' + color + ';color:' + textColor + '">' + value + '</div>' +
            '<div class="map-pin-label">' + label + '</div>' +
          '</div>',
    iconAnchor: [22, 22]
  });
  var m = L.marker([lat, lon], { icon: icon }).addTo(mapInstance);
  m.on('click', function() {
    mapPrevScreen = 'detail-screen';
    showScreen('detail-screen');
    showDetail(city);
  });
  mapCityMarkers.push(m);
}

function placeTempPins() {
  savedCities.forEach(function(city) {
    var c = globalCache[city];
    if (!c || c.lat == null) return;
    addCityPin(city, tempColor(c.currentTemp), tempTextColor(c.currentTemp), city.split(',')[0], toDisplayStr(c.currentTemp), c.lat, c.lon);
  });
}

function placeAqiPins() {
  savedCities.forEach(function(city) {
    var c = globalCache[city];
    if (!c || c.lat == null) return;
    var lat = c.lat, lon = c.lon;
    fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon + '&current=us_aqi&timezone=auto')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var aqi = d.current && d.current.us_aqi != null ? d.current.us_aqi : null;
        if (aqi == null) return;
        var color = aqiColor(aqi);
        var textColor = (aqi <= 100) ? '#000' : '#fff';
        addCityPin(city, color, textColor, city.split(',')[0], aqi + '', lat, lon);
      }).catch(function() {});
  });
}

function drawTempCanvas() {
  var points = [];
  savedCities.forEach(function(city) {
    var c = globalCache[city];
    if (!c || c.lat == null) return;
    var px = mapInstance.latLngToContainerPoint(L.latLng(c.lat, c.lon));
    points.push({ x: px.x, y: px.y, temp: c.currentTemp });
  });
  if (!points.length) return;

  var container = mapInstance.getContainer();
  var existing = container.querySelector('#map-temp-canvas');
  if (existing) existing.remove();
  var cv = document.createElement('canvas');
  cv.id = 'map-temp-canvas';
  cv.width = container.offsetWidth;
  cv.height = container.offsetHeight;
  cv.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:300;opacity:0.6;';
  container.appendChild(cv);

  var ctx2 = cv.getContext('2d');
  var imgData = ctx2.createImageData(cv.width, cv.height);
  var d = imgData.data;
  var W = cv.width, H = cv.height;

  for (var py = 0; py < H; py += 3) {
    for (var px2 = 0; px2 < W; px2 += 3) {
      var wSum = 0, tSum = 0;
      for (var i = 0; i < points.length; i++) {
        var dx = px2 - points[i].x, dy = py - points[i].y;
        var dist = Math.sqrt(dx*dx + dy*dy) + 1;
        var w = 1 / (dist * dist);
        wSum += w; tSum += w * points[i].temp;
      }
      var temp = tSum / wSum;
      var col = hexToRgbMap(tempColor(temp));
      for (var by = 0; by < 3 && py+by < H; by++) {
        for (var bx = 0; bx < 3 && px2+bx < W; bx++) {
          var idx = ((py+by) * W + (px2+bx)) * 4;
          d[idx]=col[0]; d[idx+1]=col[1]; d[idx+2]=col[2]; d[idx+3]=160;
        }
      }
    }
  }
  ctx2.putImageData(imgData, 0, 0);

  // Smooth the result
  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  var tctx = tmp.getContext('2d');
  tctx.filter = 'blur(30px)';
  tctx.drawImage(cv, 0, 0);
  ctx2.clearRect(0, 0, W, H);
  ctx2.drawImage(tmp, 0, 0);
}

function setMapLayer(layerKey) {
  mapCurrentLayer = layerKey;
  document.querySelectorAll('.map-layer-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.layer === layerKey);
  });
  clearMapOverlays();
  var existing = mapInstance.getContainer().querySelector('#map-temp-canvas');
  if (existing) existing.remove();
  mapInstance.off('moveend', drawTempCanvas);

  if (layerKey === 'temp') {
    placeTempPins();
    setTimeout(drawTempCanvas, 150);
    mapInstance.on('moveend', drawTempCanvas);
    document.getElementById('map-legend').innerHTML = buildTempLegend();

  } else if (layerKey === 'precip') {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var frames = d.radar && d.radar.past;
        if (frames && frames.length) {
          var latest = frames[frames.length - 1];
          mapOverlayLayer = L.tileLayer(
            d.host + latest.path + '/256/{z}/{x}/{y}/2/1_1.png',
            { opacity: 0.75, maxZoom: 19 }
          );
          mapOverlayLayer.addTo(mapInstance);
        }
        placeTempPins();
      }).catch(function() { placeTempPins(); });
    document.getElementById('map-legend').innerHTML = buildPrecipLegend();

  } else if (layerKey === 'aqi') {
    placeAqiPins();
    document.getElementById('map-legend').innerHTML = buildAqiLegend();
  }
}

function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;
  mapInstance = L.map('map-container', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 12,
    maxBounds: [[-85, -200], [85, 200]],
    maxBoundsViscosity: 1.0,
    zoomControl: true,
    attributionControl: true
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mapInstance);
}


function hexToRgbMap(hex) {
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

function openMapScreen() {
  showScreen('map-screen');
  setTimeout(function() {
    if (!mapInitialized) initMap();
    mapInstance.invalidateSize();
    setMapLayer(mapCurrentLayer);
    if (currentCity && globalCache[currentCity] && globalCache[currentCity].lat != null) {
      mapInstance.setView([globalCache[currentCity].lat, globalCache[currentCity].lon], 6);
    } else if (savedCities.length > 0 && globalCache[savedCities[0]] && globalCache[savedCities[0]].lat != null) {
      mapInstance.setView([globalCache[savedCities[0]].lat, globalCache[savedCities[0]].lon], 4);
    }
  }, 80);
}

document.getElementById('mapBtn').addEventListener('click', function() {
  mapPrevScreen = 'cities-screen';
  openMapScreen();
});
document.getElementById('detail-map-btn').addEventListener('click', function() {
  mapPrevScreen = 'detail-screen';
  openMapScreen();
});
document.getElementById('map-back-btn').addEventListener('click', function() {
  showScreen(mapPrevScreen);
});
document.getElementById('map-layer-bar').addEventListener('click', function(e) {
  var btn = e.target.closest('.map-layer-btn');
  if (btn && mapInstance) setMapLayer(btn.dataset.layer);
});


// =========================================================
// INIT
// =========================================================
loadCities();
updateChecks();
startLiveClock();

// Restore last-known weather cache so coords/metadata are available,
// but always fetch fresh data on startup — zero fetchedAt so spinner shows.
try {
  const wc = JSON.parse(storageGet(CACHE_KEY) || '{}');
  savedCities.forEach(function(city) {
    if (wc[city]) {
      globalCache[city] = wc[city];
      globalCache[city].fetchedAt = 0; // force fresh fetch on every startup
    }
  });
} catch(e) {}

// Render — cached cities show instantly, expired ones refetch via TTL
renderCitiesScreen();

// On startup: silently refresh weather for saved location city using stored coords (no geolocation re-run)
(async function autoRefreshLocWeather() {
  var locCity = storageGet(LOC_KEY);
  if (!locCity) return;
  var coords = cityCoords[locCity];
  if (!coords) return; // no coords stored, nothing to refresh
  try {
    const [wx, aqi] = await Promise.all([fetchWeatherData(coords.lat, coords.lon), fetchAQI(coords.lat, coords.lon)]);
    const locData = await buildWeatherData(wx, aqi);
    locData.lat = coords.lat; locData.lon = coords.lon;
    globalCache[locCity] = locData;
    renderCitiesScreen();
  } catch(e) {}
})();

// Every 5 minutes — TTL handles per-city staleness
setInterval(function() {
  renderCitiesScreen();
}, 5 * 60 * 1000);