import { z } from 'zod';

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function parseJson(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { throw new z.ZodError([]); }
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

const buckets = new Map();
export function rateLimit(key, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const record = buckets.get(key);
  if (!record || record.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  record.count += 1;
  return record.count <= max;
}

export function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'Method not allowed' });
  return false;
}
