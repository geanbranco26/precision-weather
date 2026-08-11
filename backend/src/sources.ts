import { config } from './config.js';
import { getJson } from './http.js';
import type { ForecastSeries, Hour, ModelName, Point } from './types.js';

const vars = [
  'temperature_2m','apparent_temperature','relative_humidity_2m','dew_point_2m','surface_pressure',
  'precipitation_probability','precipitation','rain','snowfall','cloud_cover',
  'wind_speed_10m','wind_gusts_10m','wind_direction_10m','visibility','weather_code'
].join(',');

function openMeteoUrl(endpoint: string, point: Point, model: string) {
  const qs = new URLSearchParams({
    latitude: String(point.lat), longitude: String(point.lon),
    hourly: vars, forecast_days: '10', timezone: 'auto', temperature_unit: 'celsius',
    wind_speed_unit: 'kmh', precipitation_unit: 'mm', models: model
  });
  if (point.elevation !== undefined) qs.set('elevation', String(point.elevation));
  return `${endpoint}?${qs}`;
}

function openMeteoMap(j: any, model: ModelName, provider = 'Open-Meteo'): ForecastSeries {
  const h = j.hourly;
  const n = h.time.length;
  const get = (key: string, i: number) => h[key]?.[i] ?? null;
  const hours: Hour[] = Array.from({ length: n }, (_, i) => ({
    time: h.time[i], tempC: get('temperature_2m', i), feelsC: get('apparent_temperature', i),
    dewC: get('dew_point_2m', i), humidity: get('relative_humidity_2m', i),
    pressure: get('surface_pressure', i), precipitationMm: get('precipitation', i),
    precipProbability: get('precipitation_probability', i), rainMm: get('rain', i),
    snowfallCm: get('snowfall', i), cloudPct: get('cloud_cover', i), windKmh: get('wind_speed_10m', i),
    windGustKmh: get('wind_gusts_10m', i), windDir: get('wind_direction_10m', i),
    visibilityKm: get('visibility', i) == null ? null : get('visibility', i) / 1000,
    weatherCode: get('weather_code', i)
  }));
  return { model, provider, generatedAt: new Date().toISOString(), timezone: j.timezone ?? 'auto', hours };
}

export async function fetchOpenMeteo(point: Point): Promise<ForecastSeries[]> {
  const endpoint = 'https://api.open-meteo.com/v1/forecast';
  const models: Array<[ModelName, string]> = [
    ['ecmwf_ifs', 'ecmwf_ifs025'],
    ['ecmwf_aifs', 'ecmwf_aifs025'],
    ['dwd_icon', 'icon_global'],
    ['noaa_gfs', 'gfs_seamless'],
    ['meteofrance_arpege', 'meteofrance_seamless']
  ];
  const results = await Promise.allSettled(models.map(async ([name, model]) => {
    const j = await getJson<any>(openMeteoUrl(endpoint, point, model));
    return openMeteoMap(j, name);
  }));
  return results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
}

export async function fetchOpenWeather(point: Point): Promise<ForecastSeries | null> {
  if (!config.openweatherKey) return null;
  const qs = new URLSearchParams({ lat: String(point.lat), lon: String(point.lon), appid: config.openweatherKey, units: 'metric', lang: 'pt_br', exclude: 'minutely,alerts' });
  const j = await getJson<any>(`https://api.openweathermap.org/data/3.0/onecall?${qs}`);
  const hours: Hour[] = (j.hourly ?? []).map((x: any) => ({
    time: new Date(x.dt * 1000).toISOString(), tempC: x.temp ?? null, feelsC: x.feels_like ?? null,
    dewC: x.dew_point ?? null, humidity: x.humidity ?? null, pressure: x.pressure ?? null,
    precipitationMm: ((x.rain?.['1h'] ?? 0) + (x.snow?.['1h'] ?? 0)),
    precipProbability: x.pop == null ? null : x.pop * 100,
    rainMm: x.rain?.['1h'] ?? 0, snowfallCm: x.snow?.['1h'] == null ? 0 : x.snow['1h'] / 10,
    cloudPct: x.clouds ?? null, windKmh: x.wind_speed == null ? null : x.wind_speed * 3.6,
    windGustKmh: x.wind_gust == null ? null : x.wind_gust * 3.6, windDir: x.wind_deg ?? null,
    visibilityKm: x.visibility == null ? null : x.visibility / 1000,
    weatherCode: x.weather?.[0]?.id ?? null
  }));
  return { model: 'openweather', provider: 'OpenWeather', generatedAt: new Date().toISOString(), timezone: j.timezone, hours };
}

export async function fetchWeatherApi(point: Point): Promise<ForecastSeries | null> {
  if (!config.weatherapiKey) return null;
  const qs = new URLSearchParams({ key: config.weatherapiKey, q: `${point.lat},${point.lon}`, days: '10', aqi: 'no', alerts: 'yes' });
  const j = await getJson<any>(`https://api.weatherapi.com/v1/forecast.json?${qs}`);
  const hours: Hour[] = (j.forecast?.forecastday ?? []).flatMap((d: any) => d.hour ?? []).map((x: any) => ({
    time: new Date(x.time).toISOString(), tempC: x.temp_c ?? null, feelsC: x.feelslike_c ?? null,
    dewC: x.dewpoint_c ?? null, humidity: x.humidity ?? null, pressure: x.pressure_mb ?? null,
    precipitationMm: x.precip_mm ?? null, precipProbability: x.chance_of_rain ?? null,
    rainMm: x.rain ?? x.precip_mm ?? null, snowfallCm: x.snow_cm ?? null, cloudPct: x.cloud ?? null,
    windKmh: x.wind_kph ?? null, windGustKmh: x.gust_kph ?? null, windDir: x.wind_degree ?? null,
    visibilityKm: x.vis_km ?? null, weatherCode: x.condition?.code ?? null
  }));
  return { model: 'weatherapi', provider: 'WeatherAPI', generatedAt: new Date().toISOString(), timezone: j.location?.tz_id ?? 'auto', hours };
}

export async function fetchMeteoblue(point: Point): Promise<ForecastSeries | null> {
  if (!config.meteoblueKey) return null;
  const qs = new URLSearchParams({
    lat: String(point.lat), lon: String(point.lon), apikey: config.meteoblueKey,
    asl: String(point.elevation ?? 0), format: 'json'
  });
  const url = `https://my.meteoblue.com/packages/basic-1h_basic-day?${qs}`;
  const j = await getJson<any>(url);
  const h = j.data_1h ?? j.data_1h_forecast;
  if (!h?.time) return null;
  const n = h.time.length;
  const gv = (k: string, i: number) => h[k]?.[i] ?? null;
  const hours: Hour[] = Array.from({ length: n }, (_, i) => ({
    time: new Date(h.time[i]).toISOString(), tempC: gv('temperature', i), feelsC: gv('felttemperature', i),
    dewC: gv('dewpointtemperature', i), humidity: gv('relativehumidity', i), pressure: gv('sealevelpressure', i),
    precipitationMm: gv('precipitation', i), precipProbability: gv('precipitation_probability', i),
    rainMm: gv('rain', i), snowfallCm: gv('snowfraction', i), cloudPct: gv('cloudcover', i),
    windKmh: gv('windspeed', i), windGustKmh: gv('windgust', i), windDir: gv('winddirection', i),
    visibilityKm: gv('visibility', i), weatherCode: gv('pictocode', i)
  }));
  return { model: 'meteoblue', provider: 'Meteoblue', generatedAt: new Date().toISOString(), timezone: j.meta?.timezone ?? 'auto', hours };
}
