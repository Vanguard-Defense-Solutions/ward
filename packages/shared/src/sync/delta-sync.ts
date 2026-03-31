import { ThreatDB } from '../engine/threat-db';
import { verify } from '../engine/db-signer';
import type { ThreatEntry } from '../types';

export interface SyncResult {
  status: 'updated' | 'current' | 'offline' | 'error';
  newThreats?: number;
  error?: string;
}

export interface DeltaSyncOptions {
  db: ThreatDB;
  publicKey: Uint8Array;
  syncUrl: string;
  fetchFn?: typeof globalThis.fetch;
}

interface SyncResponse {
  payload: string;
  signature: string;
}

interface SyncPayload {
  threats: ThreatEntry[];
  timestamp: string;
}

export class DeltaSyncClient {
  private db: ThreatDB;
  private publicKey: Uint8Array;
  private syncUrl: string;
  private fetchFn: typeof globalThis.fetch;

  constructor(options: DeltaSyncOptions) {
    this.db = options.db;
    this.publicKey = options.publicKey;
    this.syncUrl = options.syncUrl;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async sync(): Promise<SyncResult> {
    try {
      const lastSync = this.db.getLastSync();
      let url = this.syncUrl;
      if (lastSync) {
        url += `?since=${encodeURIComponent(lastSync)}`;
      }

      const response = await this.fetchFn(url);

      if (response.status === 304) {
        return { status: 'current' };
      }

      if (!response.ok) {
        return { status: 'error', error: `Server returned ${response.status}` };
      }

      const body: SyncResponse = await response.json();

      // Verify signature before applying
      const payloadBytes = new TextEncoder().encode(body.payload);
      const signatureBytes = Uint8Array.from(Buffer.from(body.signature, 'base64'));
      const valid = await verify(payloadBytes, signatureBytes, this.publicKey);

      if (!valid) {
        return { status: 'error', error: 'Invalid signature — sync response rejected' };
      }

      const payload: SyncPayload = JSON.parse(body.payload);

      // Apply threats
      if (payload.threats.length > 0) {
        this.db.insertThreats(payload.threats);
      }

      // Update sync timestamp
      this.db.setLastSync(payload.timestamp);

      return { status: 'updated', newThreats: payload.threats.length };
    } catch (err) {
      const message = (err as Error).message;
      return { status: 'offline', error: message };
    }
  }
}
