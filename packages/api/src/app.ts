import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ThreatDB } from '@ward/shared/engine/threat-db';
import { LocalEngine } from '@ward/shared/engine/index';
import { sign } from '@ward/shared/engine/db-signer';
import type { ThreatEntry } from '@ward/shared/types';
import { RateLimiter } from './rate-limit';
import type { KeyPair } from './keys';

export interface AppDeps {
  dbPath: string;
  keys: KeyPair;
  topPackages: string[];
  seedThreats?: ThreatEntry[];
  rateLimiter?: RateLimiter;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const db = new ThreatDB(deps.dbPath);
  const engine = new LocalEngine({
    dbPath: deps.dbPath,
    topPackages: deps.topPackages,
  });
  const rateLimiter = deps.rateLimiter ?? new RateLimiter({ windowMs: 60_000, maxRequests: 100 });

  // Seed threats
  if (deps.seedThreats && deps.seedThreats.length > 0) {
    db.insertThreats(deps.seedThreats);
  }

  // -- Middleware --

  // CORS — restrict to known origins (add production domain when deployed)
  app.use('*', cors({
    origin: ['https://wardshield.dev', 'http://localhost:3000', 'http://localhost:5173'],
  }));

  // Rate limiting
  app.use('*', rateLimiter.middleware());

  // Request logging
  app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`);
  });

  // -- Routes --

  // GET /health
  app.get('/health', (c) => {
    return c.json({ status: 'ok', version: '0.2.0', threats: db.count() });
  });

  // POST /check
  app.post('/check', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const { package_name, version, scripts } = body as Record<string, unknown>;

    if (!package_name || typeof package_name !== 'string') {
      return c.json({ error: 'Missing required field: package_name' }, 400);
    }
    if (!version || typeof version !== 'string') {
      return c.json({ error: 'Missing required field: version' }, 400);
    }

    const verdict = engine.check({
      name: package_name,
      version,
      scripts: scripts as Record<string, string> | undefined,
    });

    return c.json(verdict);
  });

  // GET /sync
  app.get('/sync', async (c) => {
    const since = c.req.query('since');
    const threats = since ? db.since(since) : db.all();
    const timestamp = new Date().toISOString();

    const payload = JSON.stringify({ threats, timestamp });
    const payloadBytes = new TextEncoder().encode(payload);
    const signatureBytes = await sign(payloadBytes, deps.keys.privateKey);
    const signature = Buffer.from(signatureBytes).toString('base64');

    return c.json({ payload, signature });
  });

  // GET /score/:package
  app.get('/score/:package', (c) => {
    const packageName = c.req.param('package');
    const threats = db.all();
    const isKnownThreat = threats.some((t) => t.package_name === packageName);

    if (isKnownThreat) {
      return c.json({ package: packageName, score: 0, signals: ['known-threat'] });
    }

    const isTopPackage = deps.topPackages.includes(packageName);
    if (isTopPackage) {
      return c.json({ package: packageName, score: 95, signals: ['top-package'] });
    }

    return c.json({ package: packageName, score: 50, signals: ['unknown'] });
  });

  // GET /threats
  app.get('/threats', (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const threats = db.all({ limit: limit && !isNaN(limit) ? limit : undefined });

    return c.json(threats);
  });

  // -- Error handling --
  app.onError((err, c) => {
    console.error(`Error: ${err.message}`);
    return c.json({ error: 'Internal server error' }, 500);
  });

  // 404 fallback
  app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
  });

  return { app, db, engine, rateLimiter };
}
