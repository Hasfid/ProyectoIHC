/**
 * weather.ts — Servicio de clima con Open-Meteo API (gratis, sin key).
 *
 * - Clima actual + pronóstico cada hora (próximas 4h)
 * - Genera alertas contextuales (lluvia, calor, frío, tormenta)
 *   mostradas en el widget, sin notificaciones push
 *
 * @module lib/weather
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  label: string;
  icon: string;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  label: string;
  icon: string;
}

export interface WeatherAlert {
  title: string;
  body: string;
  icon: string;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyForecast[];
  alert: WeatherAlert | null;
}

// ── WMO Weather Codes ────────────────────────────────────────────────────────

const WMO: Record<number, { label: string; icon: string }> = {
  0:  { label: 'Despejado',       icon: '☀️' },
  1:  { label: 'Mayorm. despejado', icon: '🌤️' },
  2:  { label: 'Parcialm. nublado', icon: '⛅' },
  3:  { label: 'Nublado',          icon: '☁️' },
  45: { label: 'Niebla',           icon: '🌫️' },
  48: { label: 'Niebla helada',    icon: '🌫️' },
  51: { label: 'Llovizna',         icon: '🌦️' },
  53: { label: 'Llovizna mod.',    icon: '🌦️' },
  55: { label: 'Llovizna fuerte',  icon: '🌧️' },
  61: { label: 'Lluvia leve',      icon: '🌧️' },
  63: { label: 'Lluvia moderada',  icon: '🌧️' },
  65: { label: 'Lluvia fuerte',    icon: '🌧️' },
  80: { label: 'Chubascos',        icon: '🌦️' },
  81: { label: 'Chubascos mod.',   icon: '🌧️' },
  82: { label: 'Chubascos fuertes', icon: '⛈️' },
  95: { label: 'Tormenta',         icon: '⛈️' },
  96: { label: 'Tormenta c/granizo', icon: '⛈️' },
  99: { label: 'Tormenta severa',  icon: '⛈️' },
};

const getWMO = (code: number) => WMO[code] || { label: 'Variable', icon: '🌡️' };

const isRainCode = (c: number) => [51,53,55,61,63,65,80,81,82].includes(c);
const isStormCode = (c: number) => [95,96,99].includes(c);

// ── Alertas contextuales ─────────────────────────────────────────────────────

/** Genera una alerta visual basada en el clima actual y pronóstico */
function generateAlert(current: CurrentWeather, hourly: HourlyForecast[]): WeatherAlert | null {
  const rainHour = hourly.find(h => isRainCode(h.weatherCode));
  if (rainHour && !isRainCode(current.weatherCode)) {
    return {
      title: 'Lluvia próximamente',
      body: `Se esperan lluvias a las ${rainHour.time}. ¡Llevá paraguas!`,
      icon: '🌧️',
    };
  }

  const stormHour = hourly.find(h => isStormCode(h.weatherCode));
  if (stormHour) {
    return {
      title: 'Tormenta en camino',
      body: `Tormenta a las ${stormHour.time}. Buscá refugio.`,
      icon: '⛈️',
    };
  }

  if (current.temperature >= 34) {
    return {
      title: 'Calor intenso',
      body: `${current.temperature}°C — Llevá agua y protector solar.`,
      icon: '🥵',
    };
  }

  if (current.temperature >= 30) {
    return {
      title: 'Hace calor',
      body: `${current.temperature}°C — Hidratate bien.`,
      icon: '☀️',
    };
  }

  if (isRainCode(current.weatherCode)) {
    return {
      title: 'Está lloviendo',
      body: 'Protegé tus equipos si estás al aire libre.',
      icon: '🌧️',
    };
  }

  if (current.windSpeed >= 40) {
    return {
      title: 'Viento fuerte',
      body: `Vientos de ${current.windSpeed} km/h. Precaución.`,
      icon: '💨',
    };
  }

  return null;
}

// ── API ──────────────────────────────────────────────────────────────────────

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&forecast_hours=5&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();

    const wmo = getWMO(json.current.weather_code);
    const current: CurrentWeather = {
      temperature: Math.round(json.current.temperature_2m),
      humidity: json.current.relative_humidity_2m,
      windSpeed: Math.round(json.current.wind_speed_10m),
      weatherCode: json.current.weather_code,
      label: wmo.label,
      icon: wmo.icon,
    };

    const hourly: HourlyForecast[] = (json.hourly?.time || [])
      .slice(1, 5)
      .map((iso: string, i: number) => {
        const code = json.hourly.weather_code[i + 1];
        const w = getWMO(code);
        return {
          time: `${new Date(iso).getHours().toString().padStart(2, '0')}:00`,
          temperature: Math.round(json.hourly.temperature_2m[i + 1]),
          weatherCode: code,
          label: w.label,
          icon: w.icon,
        };
      });

    const alert = generateAlert(current, hourly);
    return { current, hourly, alert };
  } catch (err) {
    console.error('Error fetching weather:', err);
    return null;
  }
}
