import 'node:process';

export const config = {
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? '0.0.0.0',
  meteoblueKey: process.env.METEOBLUE_API_KEY || undefined,
  openweatherKey: process.env.OPENWEATHER_API_KEY || undefined,
  weatherapiKey: process.env.WEATHERAPI_KEY || undefined
};
