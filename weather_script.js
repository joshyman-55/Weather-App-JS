// =========================================================
// STATE
// =========================================================
let isFahrenheit = true;
let unitMode = 'default';
let isHybrid = false;
let savedCities = [];
let globalCache = {};
let currentCity = null;
let liveAnimFrame = null;
let liveParticles = [];
let liveAnimType = null;
let searchDebounce = null;
let dragSrcCity = null;
let editMode = false;

const STORAGE_KEY = 'weather_app_cities_v2';
const FAHRENHEIT_COUNTRIES = new Set([
  'US','BS','BZ','KY','PW','FM','MH','PR','GU','VI','AS','MP'
]);
const DEFAULT_CITIES = ['New York', 'Los Angeles', 'Tokyo'];
const LOC_KEY = '__current_location__';

// =========================================================
// TEMPERATURE UTILS
// =========================================================
function tempCategory(f) {
  if (f <= -58) return 'bitter';   // <= -58°F (-50°C and below)
  if (f <= 32)  return 'frigid';   // -57°F to 32°F
  if (f <= 49)  return 'cold';     // 33°F to 49°F
  if (f <= 59)  return 'chilly';   // 50°F to 59°F
  if (f <= 77)  return 'ideal';    // 60°F to 77°F
  if (f <= 94)  return 'warm';     // 78°F to 94°F
  if (f <= 121) return 'hot';      // 95°F to 121°F
  return 'scorched';               // >= 122°F (50°C+)
}
const TEMP_COLORS = {
  bitter:'#32174d',  // Dark purple  <= -58°F
  frigid:'#8601af',  // Violet (RYB)  -57°F to 32°F
  cold:  '#0000ff',  // Blue         33°F to 49°F
  chilly:'#00ff00',  // Lime         50°F to 59°F
  ideal: '#ffff00',  // Yellow       60°F to 77°F
  warm:  '#ffa500',  // Orange       78°F to 94°F
  hot:   '#ff0000',  // Red          95°F to 121°F
  scorched:'#800000' // Maroon       >= 122°F
};
const TEMP_TEXT = {
  bitter:'#ffffff', frigid:'#ffffff', cold:'#ffffff', chilly:'#000000',
  ideal:'#000000', warm:'#ffffff', hot:'#ffffff', scorched:'#ffffff'
};

// Zone START temperatures for gradient — each color begins at this °F value
const GRAD_BOUNDS = [
  { t: -58, hex: '#32174d' },  // Bitter:   <= -58°F
  { t: -57, hex: '#8601af' },  // Frigid:   -57°F to 32°F
  { t:  33, hex: '#0000ff' },  // Cold:     33°F to 49°F
  { t:  50, hex: '#00ff00' },  // Chilly:   50°F to 59°F
  { t:  60, hex: '#ffff00' },  // Ideal:    60°F to 77°F
  { t:  78, hex: '#ffa500' },  // Warm:     78°F to 94°F
  { t:  95, hex: '#ff0000' },  // Hot:      95°F to 121°F
  { t: 122, hex: '#800000' }   // Scorched: >= 122°F
];
function tempColor(f)     { return TEMP_COLORS[tempCategory(f)] || '#888'; }
function tempTextColor(f) { return TEMP_TEXT[tempCategory(f)] || '#fff'; }
function toDisplay(f)     { return (isFahrenheit && !isHybrid) ? Math.round(f) : Math.round((f-32)*5/9); }
function toDisplayStr(f)  { return toDisplay(f) + '\u00b0'; }

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
    '&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,wind_direction_10m,dew_point_2m,visibility' +
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
  const cur = wx.current, daily = wx.daily, hourly = wx.hourly;
  const sunriseInt = milHour(daily.sunrise[0]);
  const sunsetInt  = milHour(daily.sunset[0]);
  const currentMilitary = cur.time ? milHour(cur.time+':00') : new Date().getHours()*100;
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
    hourlyData.push({
      time: timeMil,
      temp: Math.round(hourly.temperature_2m[i]),
      condition: decodeCode(hourly.weather_code[i]),
      uvIndex: hourly.uv_index[i] || 0
    });
  }
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const forecast = daily.time.map(function(t, i) {
    return {
      day: i === 0 ? 'Today' : dayNames[new Date(t+'T12:00').getDay()],
      min: Math.round(daily.temperature_2m_min[i]),
      max: Math.round(daily.temperature_2m_max[i]),
      condition: decodeCode(daily.weather_code[i])
    };
  });
  const uvMatch = hourlyData.find(function(h) { return Math.abs(h.time - currentMilitary) < 100; });
  const uvNow = uvMatch ? uvMatch.uvIndex : 0;
  return {
    currentTemp: Math.round(cur.temperature_2m),
    feelsLike: Math.round(cur.apparent_temperature),
    condition: decodeCode(cur.weather_code),
    isDay, sunriseInt, sunsetInt, currentMilitary,
    sunrise: fmt12(daily.sunrise[0]),
    sunset:  fmt12(daily.sunset[0]),
    humidity: cur.relative_humidity_2m,
    windSpeed: Math.round(cur.wind_speed_10m),
    windDir: compassDir(cur.wind_direction_10m),
    dewPoint: Math.round(cur.dew_point_2m),
    uvIndex: Math.round(uvNow),
    airQuality: aqi,
    precipitation: (daily.precipitation_sum && daily.precipitation_sum[0]) ? daily.precipitation_sum[0] : 0,
    visibility: cur.visibility,
    forecast, hourly: hourlyData, utcOffsetSeconds
  };
}
async function getWeatherForCity(cityName) {
  if (globalCache[cityName]) return globalCache[cityName];
  const results = await geocode(cityName);
  if (!results.length) throw new Error('City not found');
  const loc = results[0];
  const [wx, aqi] = await Promise.all([fetchWeatherData(loc.latitude, loc.longitude), fetchAQI(loc.latitude, loc.longitude)]);
  const data = await buildWeatherData(wx, aqi);
  globalCache[cityName] = data;
  return data;
}

// =========================================================
// CURRENT LOCATION
// =========================================================
async function addCurrentLocation() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async function(pos) {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json');
        const d = await r.json();
        const city = d.address.city || d.address.town || d.address.village || d.address.county || 'My Location';
        const countryCode = (d.address.country_code || '').toUpperCase();

        // Auto-set unit based on country when in default mode
        if (unitMode === 'default') {
          isFahrenheit = FAHRENHEIT_COUNTRIES.has(countryCode);
          updateChecks();
        }

        // Remove old current location city if name changed
        const prevCity = localStorage.getItem(LOC_KEY);
        if (prevCity && prevCity !== city) {
          savedCities = savedCities.filter(function(c) { return c !== prevCity; });
          delete globalCache[prevCity];
        }
        localStorage.setItem(LOC_KEY, city);

        // Fetch weather directly from coords
        const [wx, aqi] = await Promise.all([fetchWeatherData(lat, lon), fetchAQI(lat, lon)]);
        globalCache[city] = await buildWeatherData(wx, aqi);

        // Insert at top if not already present
        if (!savedCities.includes(city)) {
          savedCities.unshift(city);
          saveCities();
        }
        renderCitiesScreen();
      } catch (e) {
        alert('Could not get weather for your location. Please try again.');
      }
    },
    function() {
      alert('Location access was denied. Please allow location access and try again.');
    }
  );
}

// =========================================================
// STORAGE
// =========================================================
function loadCities() {
  // Auto-detect unit from browser locale on first load
  if (unitMode === 'default') {
    const locale = navigator.language || 'en-US';
    const parts = locale.split('-');
    const country = parts.length > 1 ? parts[parts.length-1] : '';
    isFahrenheit = FAHRENHEIT_COUNTRIES.has(country.toUpperCase());
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed && parsed.length) { savedCities = parsed; return; }
    }
  } catch (e) {}
  savedCities = DEFAULT_CITIES.slice();
  saveCities();
}
function saveCities() {
  // Always keep current location pinned at index 0
  const locCity = localStorage.getItem(LOC_KEY);
  if (locCity && savedCities.includes(locCity) && savedCities[0] !== locCity) {
    savedCities = savedCities.filter(function(c) { return c !== locCity; });
    savedCities.unshift(locCity);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCities));
}
function addCity(name) {
  if (!savedCities.includes(name)) { savedCities.push(name); saveCities(); }
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
function startAutoRefresh() {
  setInterval(function() {
    globalCache = {};
    renderCitiesScreen();
  }, 5 * 60 * 1000);
}

// =========================================================
// CITIES SCREEN
// =========================================================
async function renderCitiesScreen() {
  document.getElementById('cities-screen').classList.add('active');
  document.getElementById('detail-screen').classList.remove('active');
  // Sync menu button label with edit mode state
  syncEditModeUI();

  const list = document.getElementById('city-cards-list');
  list.innerHTML = '';

  if (savedCities.length === 0) {
    list.innerHTML = '<div class="empty-state">No cities added yet.<br>Use the search bar or tap Menu to add one.</div>';
    return;
  }

  for (let ci = 0; ci < savedCities.length; ci++) {
    (function(city) {
      const card = document.createElement('div');
      card.className = 'city-card';
      card.dataset.city = city;
      card.draggable = true;
      card.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
      list.appendChild(card);

      // Drag events — current location is pinned at top, cannot be moved
      const isLocCityDrag = city === localStorage.getItem(LOC_KEY);
      // Only non-location cards are draggable, and only in edit mode
      card.draggable = !isLocCityDrag;
      card.addEventListener('dragstart', function(e) {
        if (!editMode || isLocCityDrag) { e.preventDefault(); return; }
        dragSrcCity = city;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(function() { card.classList.add('dragging'); }, 0);
      });
      card.addEventListener('dragend', function() {
        card.classList.remove('dragging');
        document.querySelectorAll('.city-card').forEach(function(c) { c.classList.remove('drag-over'); });
      });
      card.addEventListener('dragover', function(e) {
        if (!editMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.city-card').forEach(function(c) { c.classList.remove('drag-over'); });
        const locCity = localStorage.getItem(LOC_KEY);
        if (city !== dragSrcCity && city !== locCity) card.classList.add('drag-over');
      });
      card.addEventListener('drop', function(e) {
        if (!editMode) return;
        e.preventDefault();
        const locCity = localStorage.getItem(LOC_KEY);
        if (dragSrcCity && dragSrcCity !== city && city !== locCity) {
          const srcIdx = savedCities.indexOf(dragSrcCity);
          const dstIdx = savedCities.indexOf(city);
          const locIdx = savedCities.indexOf(locCity);
          if (srcIdx !== -1 && dstIdx !== -1 && !(locIdx === 0 && dstIdx === 0)) {
            savedCities.splice(srcIdx, 1);
            savedCities.splice(dstIdx, 0, dragSrcCity);
            saveCities();
            renderCitiesScreen();
          }
        }
        dragSrcCity = null;
      });

      getWeatherForCity(city).then(function(data) {
        const cat = tempCategory(data.currentTemp);
        const hi  = toDisplay(data.forecast[0] ? data.forecast[0].max : data.currentTemp);
        const lo  = toDisplay(data.forecast[0] ? data.forecast[0].min : data.currentTemp);
        const name = city.split(',')[0].trim();
        const isLocCity = city === localStorage.getItem(LOC_KEY);

        card.className = 'city-card card-' + cat + (editMode ? ' show-delete' : '');
        card.dataset.city = city;
        card.draggable = true;
        card.innerHTML =
          // no drag handle — cards are draggable invisibly in edit mode
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
          (isLocCity ? '' : '<button class="delete-btn">&times;</button>');

        // Delete button — only on non-location cities
        const delBtn = card.querySelector('.delete-btn');
        if (delBtn) {
          delBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showDeleteConfirm(city, card);
          });
        }

        // Card click
        card.addEventListener('click', function(e) {
          if (e.target.classList.contains('delete-btn')) return;
          showDetail(city);
        });

      }).catch(function() {
        card.className = 'city-card card-cold';
        card.dataset.city = city;
        card.innerHTML = '<div class="card-top"><div><div class="city-name">' + city.split(',')[0] + '</div><div class="city-condition" style="opacity:0.6">Unavailable</div></div></div>';
        card.addEventListener('click', function() { showDetail(city); });
      });

    })(savedCities[ci]);
  }
}

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
      el.innerHTML = results.slice(0,5).map(function(r) {
        const sub = [r.admin1, r.country].filter(Boolean).join(', ');
        return '<div class="search-result-item" data-name="' + r.name + '"><div>' + r.name + '</div><div class="sub">' + sub + '</div></div>';
      }).join('');
      el.querySelectorAll('.search-result-item').forEach(function(item) {
        item.addEventListener('click', function() {
          const name = item.dataset.name;
          if (name) {
            addCity(name);
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
  if (e.key === 'Escape') { this.value = ''; hideSearch(); }
});
function hideSearch() {
  const el = document.getElementById('search-results');
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
  document.getElementById('detail-screen').classList.add('active');
  document.getElementById('cities-screen').classList.remove('active');
  ds.scrollTop = 0;
  currentCity = city;
  document.getElementById('detail-city').textContent = city.split(',')[0].trim();
  document.getElementById('detail-temp').textContent = '--';
  document.getElementById('detail-icon').innerHTML = '';
  document.getElementById('detail-condition').textContent = '';
  document.getElementById('hourly-inner').innerHTML = '';
  document.getElementById('forecast-rows').innerHTML = '';
  document.getElementById('detail-grid').innerHTML = '';
  setDetailBg('Clear', true, null, null, null);
  stopLiveAnim();
  try {
    const data = await getWeatherForCity(city);
    renderDetail(city, data);
  } catch (e) {
    console.error('showDetail error:', e);
    document.getElementById('detail-condition').textContent = 'Error: ' + (e && e.message ? e.message : String(e));
  }
}
function renderDetail(city, data) {
  try {
    document.getElementById('detail-screen').scrollTop = 0;
    document.getElementById('detail-city').textContent = city.split(',')[0].trim();
    const circle = document.getElementById('detail-circle');
    circle.style.backgroundColor = tempColor(data.currentTemp);
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
    { t: -57, hex: '#8601af' },
    { t:  33, hex: '#0000ff' },
    { t:  50, hex: '#00ff00' },
    { t:  60, hex: '#ffff00' },
    { t:  78, hex: '#ffa500' },
    { t:  95, hex: '#ff0000' },
    { t: 122, hex: '#800000' }
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
  grid.appendChild(makeCircleCard('AIR QUALITY', data.airQuality, aqi.label, aqi.color, aqi.text));
  grid.appendChild(makeCircleCard('UV INDEX',    data.uvIndex,    uv.label,  uv.color,  uv.text));
  grid.appendChild(makeFeelsLikeCard(data.feelsLike, data.currentTemp, data.windSpeed, data.humidity));
  grid.appendChild(makeTextCard('HUMIDITY', data.humidity + '%'));
  grid.appendChild(makeTextCard('WIND', data.windDir + ' ' + ((!isHybrid && !isFahrenheit) ? Math.round(data.windSpeed*1.609) + ' km/h' : data.windSpeed + ' mph')));
  grid.appendChild(makeTempCircleCard('DEW POINT', data.dewPoint));
  const precip = (!isHybrid && !isFahrenheit) ? (data.precipitation*2.54).toFixed(2) + ' cm' : data.precipitation.toFixed(2) + ' in';
  const vis    = (!isHybrid && !isFahrenheit) ? (data.visibility/1000).toFixed(1) + ' km' : (data.visibility/1609.34).toFixed(1) + ' mi';
  grid.appendChild(makeTextCard('PRECIPITATION', precip + '\n(24h)'));
  grid.appendChild(makeTextCard('VISIBILITY', vis));
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
  dropdownMenu.classList.remove('open'); globalCache = {}; renderCitiesScreen();
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

function applyUnit(mode) {
  unitMode = mode;
  isHybrid = (mode === 'hybrid');
  isFahrenheit = (mode !== 'metric');
  updateChecks();
  globalCache = {};
  renderCitiesScreen();
}
function updateChecks() {
  ['menuDefault','menuImperial','menuMetric','menuHybrid'].forEach(function(id) { document.getElementById(id).classList.remove('checked'); });
  const map = {default:'menuDefault', imperial:'menuImperial', metric:'menuMetric', hybrid:'menuHybrid'};
  document.getElementById(map[unitMode]).classList.add('checked');
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
  document.getElementById('cities-screen').classList.add('active');
  document.getElementById('detail-screen').classList.remove('active');
  renderCitiesScreen();
  // Poll until the cities screen has content, then restore scroll
  var attempts = 0;
  function tryRestore() {
    var el = document.getElementById('cities-screen');
    if (el.scrollHeight > el.clientHeight || attempts > 20) {
      el.scrollTop = citiesScrollY;
    } else {
      attempts++;
      setTimeout(tryRestore, 100);
    }
  }
  setTimeout(tryRestore, 100);
});

// =========================================================
// INIT
// =========================================================
loadCities();
renderCitiesScreen();
updateChecks();
startLiveClock();
startAutoRefresh();