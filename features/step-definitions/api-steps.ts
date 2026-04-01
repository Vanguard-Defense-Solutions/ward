import { Given, When, Then, Before, After, DataTable } from '@cucumber/cucumber';
import { WardWorld } from './world';
import { createApp, type AppDeps } from '../../packages/api/src/app';
import { RateLimiter } from '../../packages/api/src/rate-limit';
import { generateKeyPair, verify } from '../../packages/shared/src/engine/db-signer';
import type { ThreatEntry } from '../../packages/shared/src/types';
import type { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import os from 'os';

// API-specific state stored per-world
interface ApiState {
  app: Hono | null;
  dbPath: string;
  keys: { publicKey: Uint8Array; privateKey: Uint8Array } | null;
  wrongKeys: { publicKey: Uint8Array; privateKey: Uint8Array } | null;
  rateLimiter: RateLimiter | null;
  seedThreats: ThreatEntry[];
  topPackages: string[];
  lastResponse: Response | null;
  lastBody: any;
  responses: Array<{ status: number; body: any }>;
  cleanup: (() => void) | null;
}

const apiStateMap = new WeakMap<WardWorld, ApiState>();

function getApiState(world: WardWorld): ApiState {
  if (!apiStateMap.has(world)) {
    apiStateMap.set(world, {
      app: null,
      dbPath: '',
      keys: null,
      wrongKeys: null,
      rateLimiter: null,
      seedThreats: [],
      topPackages: ['react', 'express', 'lodash', 'axios', 'typescript'],
      lastResponse: null,
      lastBody: null,
      responses: [],
      cleanup: null,
    });
  }
  return apiStateMap.get(world)!;
}

async function ensureApp(world: WardWorld): Promise<ApiState> {
  const state = getApiState(world);
  if (!state.app) {
    state.dbPath = path.join(world.tempDir, `api-test-${Date.now()}.db`);
    if (!state.keys) {
      state.keys = await generateKeyPair();
    }
    if (!state.rateLimiter) {
      state.rateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 100 });
    }
    const result = createApp({
      dbPath: state.dbPath,
      keys: state.keys,
      topPackages: state.topPackages,
      seedThreats: state.seedThreats,
      rateLimiter: state.rateLimiter,
    });
    state.app = result.app;
    state.cleanup = () => {
      result.db.close();
      try { fs.unlinkSync(state.dbPath); } catch {}
      try { fs.unlinkSync(state.dbPath + '-wal'); } catch {}
      try { fs.unlinkSync(state.dbPath + '-shm'); } catch {}
    };
  }
  return state;
}

After(function (this: WardWorld) {
  const state = apiStateMap.get(this);
  if (state?.cleanup) {
    try { state.cleanup(); } catch {}
  }
});

// ──────────────────────────────────────────────────────────
// GIVEN
// ──────────────────────────────────────────────────────────

Given('the API is seeded with the following threats:', async function (this: WardWorld, table: DataTable) {
  const state = getApiState(this);
  state.seedThreats = [];
  for (const row of table.hashes()) {
    state.seedThreats.push({
      package_name: row.package_name,
      version: row.version,
      threat_type: row.threat_type,
      description: row.description,
      safe_version: row.safe_version === 'none' ? undefined : row.safe_version,
      detected_at: row.detected_at,
    });
  }
  // Reset app so it gets re-created with new seed
  if (state.cleanup) { try { state.cleanup(); } catch {} }
  state.app = null;
  state.cleanup = null;
});

Given('the API is seeded with {int} known threats', async function (this: WardWorld, count: number) {
  const state = getApiState(this);
  state.seedThreats = [];
  for (let i = 0; i < count; i++) {
    state.seedThreats.push({
      package_name: `threat-${i}`,
      version: '1.0.0',
      threat_type: 'malware',
      description: `Threat ${i}`,
      detected_at: new Date().toISOString(),
    });
  }
  if (state.cleanup) { try { state.cleanup(); } catch {} }
  state.app = null;
  state.cleanup = null;
});

Given('the API is seeded with no threats', async function (this: WardWorld) {
  const state = getApiState(this);
  state.seedThreats = [];
  if (state.cleanup) { try { state.cleanup(); } catch {} }
  state.app = null;
  state.cleanup = null;
});

Given('the top packages list includes {string}, {string}, {string}, {string}', function (this: WardWorld, a: string, b: string, c: string, d: string) {
  const state = getApiState(this);
  state.topPackages = [...new Set([...state.topPackages, a, b, c, d])];
});

Given('the package {string} version {string} is a known threat', async function (this: WardWorld, pkg: string, version: string) {
  const state = getApiState(this);
  // Check if already seeded
  const exists = state.seedThreats.some(t => t.package_name === pkg && t.version === version);
  if (!exists) {
    state.seedThreats.push({
      package_name: pkg,
      version,
      threat_type: 'malware',
      description: `${pkg} is a known threat`,
      detected_at: new Date().toISOString(),
    });
    if (state.cleanup) { try { state.cleanup(); } catch {} }
    state.app = null;
    state.cleanup = null;
  }
});

Given('the rate limiter allows {int} requests per minute', async function (this: WardWorld, max: number) {
  const state = getApiState(this);
  state.rateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: max });
  // Reset app
  if (state.cleanup) { try { state.cleanup(); } catch {} }
  state.app = null;
  state.cleanup = null;
});

Given('the rate limiter allows {int} requests per window', async function (this: WardWorld, max: number) {
  const state = getApiState(this);
  state.rateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: max });
  if (state.cleanup) { try { state.cleanup(); } catch {} }
  state.app = null;
  state.cleanup = null;
});

Given("the API's Ed25519 public key is known", async function (this: WardWorld) {
  // Keys are already generated in ensureApp — nothing extra needed
});

Given('a different Ed25519 key pair is generated', async function (this: WardWorld) {
  const state = getApiState(this);
  state.wrongKeys = await generateKeyPair();
});

// ──────────────────────────────────────────────────────────
// WHEN
// ──────────────────────────────────────────────────────────

When('I POST \\/check with body:', async function (this: WardWorld, body: string) {
  const state = await ensureApp(this);
  state.lastResponse = await state.app!.request('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body.trim(),
  });
  try {
    state.lastBody = await state.lastResponse.clone().json();
  } catch {
    state.lastBody = await state.lastResponse.clone().text();
  }
  state.responses.push({ status: state.lastResponse.status, body: state.lastBody });
});

When('I POST \\/check with raw body {string}', async function (this: WardWorld, rawBody: string) {
  const state = await ensureApp(this);
  state.lastResponse = await state.app!.request('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
  try {
    state.lastBody = await state.lastResponse.clone().json();
  } catch {
    state.lastBody = await state.lastResponse.clone().text();
  }
  state.responses.push({ status: state.lastResponse.status, body: state.lastBody });
});

When(/^I request GET (.+)$/, async function (this: WardWorld, urlPath: string) {
  const state = await ensureApp(this);
  state.lastResponse = await state.app!.request(urlPath.trim());
  try {
    state.lastBody = await state.lastResponse.clone().json();
  } catch {
    state.lastBody = await state.lastResponse.clone().text();
  }
  state.responses.push({ status: state.lastResponse.status, body: state.lastBody });
});

When(/^I send (\d+) requests? to GET (.+)$/, async function (this: WardWorld, countStr: string, urlPath: string) {
  const count = parseInt(countStr, 10);
  const state = await ensureApp(this);
  for (let i = 0; i < count; i++) {
    const res = await state.app!.request(urlPath.trim());
    let body: any;
    try {
      body = await res.clone().json();
    } catch {
      body = await res.clone().text();
    }
    state.responses.push({ status: res.status, body });
    state.lastResponse = res;
    state.lastBody = body;
  }
});

When(/^I send (\d+) more requests? to GET (.+)$/, async function (this: WardWorld, countStr: string, urlPath: string) {
  const count = parseInt(countStr, 10);
  const state = await ensureApp(this);
  for (let i = 0; i < count; i++) {
    const res = await state.app!.request(urlPath.trim());
    let body: any;
    try {
      body = await res.clone().json();
    } catch {
      body = await res.clone().text();
    }
    state.responses.push({ status: res.status, body });
    state.lastResponse = res;
    state.lastBody = body;
  }
});

When('the rate limit window resets', function (this: WardWorld) {
  const state = getApiState(this);
  if (state.rateLimiter) {
    state.rateLimiter.reset();
  }
});

// ──────────────────────────────────────────────────────────
// THEN
// ──────────────────────────────────────────────────────────

Then('the response status is {int}', function (this: WardWorld, status: number) {
  const state = getApiState(this);
  if (!state.lastResponse) throw new Error('No response');
  if (state.lastResponse.status !== status) {
    throw new Error(`Expected status ${status}, got ${state.lastResponse.status}. Body: ${JSON.stringify(state.lastBody)}`);
  }
});

Then('the verdict action is {string}', function (this: WardWorld, action: string) {
  const state = getApiState(this);
  if (state.lastBody?.action !== action) {
    throw new Error(`Expected action "${action}", got "${state.lastBody?.action}"`);
  }
});

Then('the verdict signals include a {string} signal with severity {string}', function (this: WardWorld, type: string, severity: string) {
  const state = getApiState(this);
  const signals = state.lastBody?.signals ?? [];
  const found = signals.some((s: any) => s.type === type && s.severity === severity);
  if (!found) {
    throw new Error(`Expected signal type="${type}" severity="${severity}" in ${JSON.stringify(signals)}`);
  }
});

Then('the verdict signals include an {string} signal', function (this: WardWorld, type: string) {
  const state = getApiState(this);
  const signals = state.lastBody?.signals ?? [];
  const found = signals.some((s: any) => s.type === type);
  if (!found) {
    throw new Error(`Expected signal type="${type}" in ${JSON.stringify(signals)}`);
  }
});

Then('the verdict signals do not include a {string} signal', function (this: WardWorld, type: string) {
  const state = getApiState(this);
  const signals = state.lastBody?.signals ?? [];
  const found = signals.some((s: any) => s.type === type);
  if (found) {
    throw new Error(`Expected no signal type="${type}" but found one`);
  }
});

Then('the verdict includes a safe version {string}', function (this: WardWorld, version: string) {
  const state = getApiState(this);
  if (state.lastBody?.safeVersion !== version) {
    throw new Error(`Expected safeVersion "${version}", got "${state.lastBody?.safeVersion}"`);
  }
});

Then('the response error contains {string}', function (this: WardWorld, text: string) {
  const state = getApiState(this);
  const error = state.lastBody?.error ?? '';
  if (!error.includes(text)) {
    throw new Error(`Expected error to contain "${text}", got: "${error}"`);
  }
});

Then('the response contains status {string}', function (this: WardWorld, status: string) {
  const state = getApiState(this);
  if (state.lastBody?.status !== status) {
    throw new Error(`Expected status "${status}", got "${state.lastBody?.status}"`);
  }
});

Then('the response contains the threat count', function (this: WardWorld) {
  const state = getApiState(this);
  if (typeof state.lastBody?.threats !== 'number') {
    throw new Error(`Expected threats count, got ${state.lastBody?.threats}`);
  }
});

Then('the response contains the API version', function (this: WardWorld) {
  const state = getApiState(this);
  if (!state.lastBody?.version) {
    throw new Error('Expected version in response');
  }
});

Then('the response field {string} equals {int}', function (this: WardWorld, field: string, value: number) {
  const state = getApiState(this);
  if (state.lastBody?.[field] !== value) {
    throw new Error(`Expected ${field}=${value}, got ${state.lastBody?.[field]}`);
  }
});

Then('the response field {string} equals {string}', function (this: WardWorld, field: string, value: string) {
  const state = getApiState(this);
  if (state.lastBody?.[field] !== value) {
    throw new Error(`Expected ${field}="${value}", got "${state.lastBody?.[field]}"`);
  }
});

Then('the response Content-Type is {string}', function (this: WardWorld, contentType: string) {
  const state = getApiState(this);
  if (!state.lastResponse) throw new Error('No response');
  const ct = state.lastResponse.headers.get('content-type') ?? '';
  if (!ct.includes(contentType)) {
    throw new Error(`Expected Content-Type "${contentType}", got "${ct}"`);
  }
});

// Sync specific
Then('the response contains a {string} field', function (this: WardWorld, field: string) {
  const state = getApiState(this);
  if (!(field in state.lastBody)) {
    throw new Error(`Expected field "${field}" in response: ${JSON.stringify(state.lastBody)}`);
  }
});

Then('the payload contains all {int} seeded threats', function (this: WardWorld, count: number) {
  const state = getApiState(this);
  const payload = JSON.parse(state.lastBody.payload);
  if (payload.threats.length !== count) {
    throw new Error(`Expected ${count} threats in payload, got ${payload.threats.length}`);
  }
});

Then('the payload contains a {string} field', function (this: WardWorld, field: string) {
  const state = getApiState(this);
  const payload = JSON.parse(state.lastBody.payload);
  if (!(field in payload)) {
    throw new Error(`Expected field "${field}" in payload`);
  }
});

Then('the payload contains {int} threats', function (this: WardWorld, count: number) {
  const state = getApiState(this);
  const payload = JSON.parse(state.lastBody.payload);
  if (payload.threats.length !== count) {
    throw new Error(`Expected ${count} threats, got ${payload.threats.length}`);
  }
});

Then('the payload threats are all detected after {string}', function (this: WardWorld, since: string) {
  const state = getApiState(this);
  const payload = JSON.parse(state.lastBody.payload);
  for (const threat of payload.threats) {
    if (threat.detected_at <= since) {
      throw new Error(`Threat ${threat.package_name} detected_at=${threat.detected_at} is not after ${since}`);
    }
  }
});

Then('the signature is a valid base64 string', function (this: WardWorld) {
  const state = getApiState(this);
  const sig = state.lastBody.signature;
  if (!sig || typeof sig !== 'string') {
    throw new Error('Expected signature string');
  }
  // Validate base64
  const decoded = Buffer.from(sig, 'base64');
  if (decoded.length === 0) {
    throw new Error('Signature decoded to empty');
  }
});

Then('the Ed25519 signature verifies the payload with the public key', async function (this: WardWorld) {
  const state = getApiState(this);
  const payloadBytes = new TextEncoder().encode(state.lastBody.payload);
  const signatureBytes = Uint8Array.from(Buffer.from(state.lastBody.signature, 'base64'));
  const valid = await verify(payloadBytes, signatureBytes, state.keys!.publicKey);
  if (!valid) {
    throw new Error('Signature verification failed');
  }
});

Then('the signature does NOT verify with the wrong public key', async function (this: WardWorld) {
  const state = getApiState(this);
  if (!state.wrongKeys) throw new Error('Wrong keys not generated');
  const payloadBytes = new TextEncoder().encode(state.lastBody.payload);
  const signatureBytes = Uint8Array.from(Buffer.from(state.lastBody.signature, 'base64'));
  const valid = await verify(payloadBytes, signatureBytes, state.wrongKeys.publicKey);
  if (valid) {
    throw new Error('Signature should NOT verify with wrong key');
  }
});

Then('each threat in the payload has {string}', function (this: WardWorld, field: string) {
  const state = getApiState(this);
  const payload = JSON.parse(state.lastBody.payload);
  for (const threat of payload.threats) {
    if (!(field in threat)) {
      throw new Error(`Expected field "${field}" in threat: ${JSON.stringify(threat)}`);
    }
  }
});

// Score specific
Then('the score is {int}', function (this: WardWorld, score: number) {
  const state = getApiState(this);
  if (state.lastBody?.score !== score) {
    throw new Error(`Expected score ${score}, got ${state.lastBody?.score}`);
  }
});

Then('the score is at least {int}', function (this: WardWorld, minScore: number) {
  const state = getApiState(this);
  if (state.lastBody?.score < minScore) {
    throw new Error(`Expected score >= ${minScore}, got ${state.lastBody?.score}`);
  }
});

Then('the signals include {string}', function (this: WardWorld, signal: string) {
  const state = getApiState(this);
  const signals = state.lastBody?.signals ?? [];
  if (!signals.includes(signal)) {
    throw new Error(`Expected signals to include "${signal}", got: ${JSON.stringify(signals)}`);
  }
});

// Threats endpoint
Then('the response is an array of {int} threats', function (this: WardWorld, count: number) {
  const state = getApiState(this);
  if (!Array.isArray(state.lastBody)) {
    throw new Error(`Expected array, got ${typeof state.lastBody}`);
  }
  if (state.lastBody.length !== count) {
    throw new Error(`Expected ${count} threats, got ${state.lastBody.length}`);
  }
});

Then('the response is an array of {int} threat', function (this: WardWorld, count: number) {
  const state = getApiState(this);
  if (!Array.isArray(state.lastBody) || state.lastBody.length !== count) {
    throw new Error(`Expected array of ${count}, got ${state.lastBody?.length}`);
  }
});

Then('the response is an empty array', function (this: WardWorld) {
  const state = getApiState(this);
  if (!Array.isArray(state.lastBody) || state.lastBody.length !== 0) {
    throw new Error('Expected empty array');
  }
});

Then('the threats are sorted by detected_at descending', function (this: WardWorld) {
  const state = getApiState(this);
  const threats = state.lastBody;
  for (let i = 1; i < threats.length; i++) {
    if (threats[i - 1].detected_at < threats[i].detected_at) {
      throw new Error('Threats not sorted by detected_at descending');
    }
  }
});

Then('the first threat is {string}', function (this: WardWorld, pkg: string) {
  const state = getApiState(this);
  const threats = Array.isArray(state.lastBody) ? state.lastBody : [];
  if (threats[0]?.package_name !== pkg) {
    throw new Error(`Expected first threat to be "${pkg}", got "${threats[0]?.package_name}"`);
  }
});

Then('the last threat is {string}', function (this: WardWorld, pkg: string) {
  const state = getApiState(this);
  const threats = Array.isArray(state.lastBody) ? state.lastBody : [];
  if (threats[threats.length - 1]?.package_name !== pkg) {
    throw new Error(`Expected last threat to be "${pkg}", got "${threats[threats.length - 1]?.package_name}"`);
  }
});

Then('the second threat is {string}', function (this: WardWorld, pkg: string) {
  const state = getApiState(this);
  const threats = Array.isArray(state.lastBody) ? state.lastBody : [];
  if (threats[1]?.package_name !== pkg) {
    throw new Error(`Expected second threat to be "${pkg}", got "${threats[1]?.package_name}"`);
  }
});

Then('each threat has {string}', function (this: WardWorld, field: string) {
  const state = getApiState(this);
  const threats = Array.isArray(state.lastBody) ? state.lastBody : [];
  for (const threat of threats) {
    if (!(field in threat)) {
      throw new Error(`Expected field "${field}" in threat: ${JSON.stringify(threat)}`);
    }
  }
});

// Rate limiting
Then('all {int} responses have status {int}', function (this: WardWorld, count: number, status: number) {
  const state = getApiState(this);
  for (let i = 0; i < count; i++) {
    if (state.responses[i]?.status !== status) {
      throw new Error(`Response ${i + 1} expected status ${status}, got ${state.responses[i]?.status}`);
    }
  }
});

Then('the first {int} responses have status {int}', function (this: WardWorld, count: number, status: number) {
  const state = getApiState(this);
  for (let i = 0; i < count; i++) {
    if (state.responses[i]?.status !== status) {
      throw new Error(`Response ${i + 1} expected status ${status}, got ${state.responses[i]?.status}`);
    }
  }
});

Then('the {int}th response has status {int}', function (this: WardWorld, n: number, status: number) {
  const state = getApiState(this);
  const idx = n - 1;
  if (state.responses[idx]?.status !== status) {
    throw new Error(`Response ${n} expected status ${status}, got ${state.responses[idx]?.status}`);
  }
});

Then('the {int}th response error contains {string}', function (this: WardWorld, n: number, text: string) {
  const state = getApiState(this);
  const idx = n - 1;
  const error = state.responses[idx]?.body?.error ?? '';
  if (!error.includes(text)) {
    throw new Error(`Response ${n} error expected to contain "${text}", got "${error}"`);
  }
});

Then('the {int}th response includes a {string} field', function (this: WardWorld, n: number, field: string) {
  const state = getApiState(this);
  const idx = n - 1;
  if (!(field in (state.responses[idx]?.body ?? {}))) {
    throw new Error(`Response ${n} expected field "${field}"`);
  }
});

Then('the last response has status {int}', function (this: WardWorld, status: number) {
  const state = getApiState(this);
  const last = state.responses[state.responses.length - 1];
  if (last?.status !== status) {
    throw new Error(`Last response expected status ${status}, got ${last?.status}`);
  }
});

Then('the {int}st response has status {int}', function (this: WardWorld, _n: number, _status: number) {
  // Alias — handled by Nth response
});
