export type ModelName =
  | 'ecmwf_ifs'
  | 'ecmwf_aifs'
  | 'dwd_icon'
  | 'noaa_gfs'
  | 'meteofrance_arpege'
  | 'openweather'
  | 'weatherapi'
  | 'meteoblue';

export type Point = { lat: number; lon: number; elevation?: number };

export type Hour = {
  time: string;
  tempC: number | null;
  feelsC: number | null;
  dewC: number | null;
  humidity: number | null;
  pressure: number | null;
  precipitationMm: number | null;
  precipProbability: number | null;
  rainMm: number | null;
  snowfallCm: number | null;
  cloudPct: number | null;
  windKmh: number | null;
  windGustKmh: number | null;
  windDir: number | null;
  visibilityKm: number | null;
  weatherCode: number | null;
};

export type ForecastSeries = {
  model: ModelName;
  provider: string;
  generatedAt: string;
  timezone: string;
  hours: Hour[];
};

export type ConsensusHour = Hour & {
  confidence: number;
  dispersion: Partial<Record<keyof Hour, number>>;
  contributors: { model: ModelName; weight: number }[];
};
