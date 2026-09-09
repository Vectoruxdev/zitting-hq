/**
 * Weather for home — Colorado City, Arizona — from Open-Meteo (free, no key).
 * Fetched server-side, cached 15 minutes, never more than 4 s, never throws.
 * WMO weather codes map to a short label and a Lucide glyph.
 */
export const HOME_PLACE = { name: "Colorado City", region: "Arizona", latitude: 36.9903, longitude: -112.9758 };

export interface WeatherDay { dateISO: string; hi: number; lo: number; code: number; label: string; icon: string; precip: number | null }
export interface Weather {
  temp: number; feelsLike: number; code: number; label: string; icon: string; isDay: boolean; wind: number; humidity: number;
  today: WeatherDay; days: WeatherDay[]; sunrise: string | null; sunset: string | null; fetchedAt: string;
}

export function describeWmo(code: number, isDay = true): { label: string; icon: string } {
  if (code === 0) return { label: isDay ? "Sunny" : "Clear", icon: isDay ? "sun" : "moon" };
  if (code === 1) return { label: isDay ? "Mostly sunny" : "Mostly clear", icon: isDay ? "sun" : "moon" };
  if (code === 2) return { label: "Partly cloudy", icon: isDay ? "cloud-sun" : "cloud-moon" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "cloud-fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "cloud-drizzle" };
  if (code >= 61 && code <= 67) return { label: code >= 66 ? "Freezing rain" : "Rain", icon: "cloud-rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "cloud-snow" };
  if (code >= 80 && code <= 82) return { label: "Showers", icon: "cloud-rain" };
  if (code === 85 || code === 86) return { label: "Snow showers", icon: "cloud-snow" };
  if (code === 95) return { label: "Thunderstorm", icon: "cloud-lightning" };
  if (code === 96 || code === 99) return { label: "Storm with hail", icon: "cloud-hail" };
  return { label: "Weather", icon: "cloud" };
}

interface OpenMeteo {
  current?: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number; is_day: number; time: string };
  daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[]; precipitation_probability_max: (number | null)[]; sunrise: string[]; sunset: string[] };
}

export async function fetchWeather(): Promise<Weather | null> {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(HOME_PLACE.latitude));
  u.searchParams.set("longitude", String(HOME_PLACE.longitude));
  u.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day");
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset");
  u.searchParams.set("temperature_unit", "fahrenheit");
  u.searchParams.set("wind_speed_unit", "mph");
  u.searchParams.set("timezone", "America/Denver");
  u.searchParams.set("forecast_days", "4");
  try {
    const res = await fetch(u, { next: { revalidate: 900 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = (await res.json()) as OpenMeteo;
    if (!j.current || !j.daily) return null;
    const days: WeatherDay[] = j.daily.time.map((t, i) => ({ dateISO: t, hi: Math.round(j.daily!.temperature_2m_max[i]), lo: Math.round(j.daily!.temperature_2m_min[i]), code: j.daily!.weather_code[i], precip: j.daily!.precipitation_probability_max?.[i] ?? null, ...describeWmo(j.daily!.weather_code[i], true) }));
    const isDay = j.current.is_day === 1;
    return {
      temp: Math.round(j.current.temperature_2m), feelsLike: Math.round(j.current.apparent_temperature), code: j.current.weather_code, ...describeWmo(j.current.weather_code, isDay), isDay,
      wind: Math.round(j.current.wind_speed_10m), humidity: Math.round(j.current.relative_humidity_2m),
      today: days[0], days: days.slice(1), sunrise: j.daily.sunrise?.[0] ?? null, sunset: j.daily.sunset?.[0] ?? null, fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
