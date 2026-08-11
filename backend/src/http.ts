import { request } from 'undici';

export async function getJson<T>(url: string): Promise<T> {
  const res = await request(url, { headers: { accept: 'application/json', 'user-agent': 'precision-weather/1.0' } });
  if (res.statusCode < 200 || res.statusCode >= 300) throw new Error(`HTTP ${res.statusCode}: ${url}`);
  return await res.body.json() as T;
}
