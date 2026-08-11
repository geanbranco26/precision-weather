import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { config } from './config.js';
import { fetchMeteoblue, fetchOpenMeteo, fetchOpenWeather, fetchWeatherApi } from './sources.js';
import { buildConsensus } from './consensus.js';
import { saveForecasts, recentForecastCount } from './db.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const Query = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180), elevation: z.coerce.number().optional() });

app.get('/health', async () => ({ ok: true, forecastRecords: recentForecastCount() }));

app.get('/v1/weather', async (req: FastifyRequest, reply: FastifyReply) => {
  const parsed = Query.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const point = parsed.data;
  const results = await Promise.allSettled([
    fetchOpenMeteo(point), fetchOpenWeather(point), fetchWeatherApi(point), fetchMeteoblue(point)
  ]);
  const series = results.flatMap(r => {
    if (r.status !== 'fulfilled' || !r.value) return [];
    return Array.isArray(r.value) ? r.value : [r.value];
  });
  if (!series.length) return reply.code(502).send({ error: 'Nenhuma fonte meteorológica respondeu.' });
  const consensus = buildConsensus(series);
  saveForecasts(point, series);
  const now = new Date();
  const current = consensus.find(x => new Date(x.time) >= now) ?? consensus[0];
  return { point, generatedAt: new Date().toISOString(), sources: series.map(s => ({ model:s.model, provider:s.provider })), current, hourly: consensus, raw: series };
});

app.listen({ port: config.port, host: config.host });
