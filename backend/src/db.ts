import Database from 'better-sqlite3';
import type { ForecastSeries, Point } from './types.js';

const db = new Database('precision-weather.db');
db.exec(`CREATE TABLE IF NOT EXISTS forecasts (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, model TEXT NOT NULL, payload TEXT NOT NULL);`);
db.exec(`CREATE TABLE IF NOT EXISTS observations (id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, source TEXT NOT NULL, temp_c REAL, rain_mm REAL, wind_kmh REAL, humidity REAL);`);

export function saveForecasts(point: Point, series: ForecastSeries[]) {
  const stmt = db.prepare('INSERT INTO forecasts (created_at,lat,lon,model,payload) VALUES (?,?,?,?,?)');
  const tx = db.transaction((rows: ForecastSeries[]) => { for (const s of rows) stmt.run(new Date().toISOString(), point.lat, point.lon, s.model, JSON.stringify(s)); });
  tx(series);
}

export function recentForecastCount() { return (db.prepare('SELECT COUNT(*) as c FROM forecasts').get() as any).c as number; }
