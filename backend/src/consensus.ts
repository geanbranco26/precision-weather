import type { ConsensusHour, ForecastSeries, Hour, ModelName } from './types.js';

// Pesos iniciais. O banco de erros pode adaptar esses pesos por região/horizonte.
const BASE: Record<ModelName, number> = {
  ecmwf_ifs: 0.28, ecmwf_aifs: 0.16, dwd_icon: 0.19, noaa_gfs: 0.16,
  meteofrance_arpege: 0.10, meteoblue: 0.06, openweather: 0.03, weatherapi: 0.02
};

const numeric = ['tempC','feelsC','dewC','humidity','pressure','precipitationMm','precipProbability','rainMm','snowfallCm','cloudPct','windKmh','windGustKmh','windDir','visibilityKm'] as const;
type NumKey = typeof numeric[number];

function circularMeanDeg(values: Array<{v:number,w:number}>): number | null {
  if (!values.length) return null;
  let x = 0, y = 0;
  for (const a of values) { const r = a.v * Math.PI / 180; x += Math.cos(r) * a.w; y += Math.sin(r) * a.w; }
  const deg = Math.atan2(y, x) * 180 / Math.PI;
  return (deg + 360) % 360;
}
function mean(vals: Array<{v:number,w:number}>): number | null { const s = vals.reduce((a,b)=>a+b.w,0); return s ? vals.reduce((a,b)=>a+b.v*b.w,0)/s : null; }
function weightedMad(vals: Array<{v:number,w:number}>): number {
  if (!vals.length) return 0;
  const m = mean(vals) ?? 0;
  const s = vals.reduce((a,b)=>a+b.w,0) || 1;
  return vals.reduce((a,b)=>a+Math.abs(b.v-m)*b.w,0)/s;
}

function normalizedWeights(series: ForecastSeries[]) {
  const available = series.filter(s => s.hours.length);
  const total = available.reduce((a,s)=>a+(BASE[s.model] ?? 0.05),0) || 1;
  return new Map(available.map(s => [s.model, (BASE[s.model] ?? 0.05)/total]));
}

export function buildConsensus(series: ForecastSeries[]): ConsensusHour[] {
  if (!series.length) return [];
  const weights = normalizedWeights(series);
  const refTimes = series[0].hours.map(x=>x.time);
  const out: ConsensusHour[] = [];
  for (let i=0; i<refTimes.length; i++) {
    const rows = series.map(s=>({ s, h:s.hours[i] })).filter(x=>x.h && x.h.time);
    const h: Partial<Hour> = { time: refTimes[i] };
    const dispersion: any = {};
    for (const k of numeric) {
      const vals = rows.filter(x=>typeof (x.h as any)[k] === 'number').map(x=>({v:(x.h as any)[k] as number,w:weights.get(x.s.model) ?? 0}));
      const v = k === 'windDir' ? circularMeanDeg(vals) : mean(vals);
      (h as any)[k] = v;
      dispersion[k] = weightedMad(vals);
    }
    const codes = rows.filter(x=>typeof x.h.weatherCode === 'number');
    h.weatherCode = codes.sort((a,b)=> (weights.get(b.s.model)??0)-(weights.get(a.s.model)??0))[0]?.h.weatherCode ?? null;
    const tempDisp = dispersion.tempC ?? 0;
    const rainDisp = dispersion.precipProbability ?? 0;
    const agreement = Math.max(0, Math.min(1, 1 - (tempDisp/5 + rainDisp/40)/2));
    const confidence = Math.round(100 * agreement);
    out.push({ ...(h as Hour), confidence, dispersion, contributors: rows.map(x=>({model:x.s.model, weight:weights.get(x.s.model)??0})) });
  }
  return out;
}
