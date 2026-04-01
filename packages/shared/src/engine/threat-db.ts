import { openDatabase, type SQLiteDB } from './sqlite-compat';
import type { Signal, ThreatEntry } from '../types';

export class ThreatDB {
  private db: SQLiteDB;

  constructor(dbPath: string) {
    this.db = openDatabase(dbPath);
    this.db.prepare('PRAGMA journal_mode = WAL').run();
    this.db.prepare('PRAGMA busy_timeout = 5000').run();
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threats (
        package_name TEXT NOT NULL,
        version TEXT NOT NULL,
        threat_type TEXT NOT NULL,
        description TEXT NOT NULL,
        safe_version TEXT,
        detected_at TEXT NOT NULL,
        PRIMARY KEY (package_name, version)
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_threats_lookup
        ON threats (package_name, version);
    `);
  }

  lookup(packageName: string, version: string): Signal | null {
    const row = this.db
      .prepare('SELECT * FROM threats WHERE package_name = ? AND version = ?')
      .get(packageName, version) as ThreatEntry | undefined;

    if (!row) return null;

    return {
      type: 'known-threat',
      severity: 'critical',
      message: row.description,
      safeVersion: row.safe_version ?? undefined,
      details: { threatType: row.threat_type },
    };
  }

  insertThreat(entry: ThreatEntry): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO threats (package_name, version, threat_type, description, safe_version, detected_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(entry.package_name, entry.version, entry.threat_type, entry.description, entry.safe_version ?? null, entry.detected_at);
  }

  insertThreats(entries: ThreatEntry[]): void {
    if (entries.length === 0) return;
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO threats (package_name, version, threat_type, description, safe_version, detected_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const tx = this.db.transaction((rows: ThreatEntry[]) => {
      for (const row of rows) {
        insert.run(row.package_name, row.version, row.threat_type, row.description, row.safe_version ?? null, row.detected_at);
      }
    });
    tx(entries);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM threats').get() as { count: number };
    return row.count;
  }

  /** Return all threats, ordered by detected_at descending. */
  all(options?: { limit?: number }): ThreatEntry[] {
    if (options?.limit && Number.isFinite(options.limit) && options.limit > 0) {
      return this.db.prepare('SELECT * FROM threats ORDER BY detected_at DESC LIMIT ?')
        .all(Math.floor(options.limit)) as ThreatEntry[];
    }
    return this.db.prepare('SELECT * FROM threats ORDER BY detected_at DESC')
      .all() as ThreatEntry[];
  }

  /** Return threats detected after the given ISO timestamp. */
  since(timestamp: string): ThreatEntry[] {
    return this.db
      .prepare('SELECT * FROM threats WHERE detected_at > ? ORDER BY detected_at DESC')
      .all(timestamp) as ThreatEntry[];
  }

  setLastSync(timestamp: string): void {
    this.db
      .prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)')
      .run('last_sync', timestamp);
  }

  getLastSync(): string | null {
    const row = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('last_sync') as { value: string } | undefined;
    return row?.value ?? null;
  }

  getPragma(name: string): string {
    return this.db.getPragma(name);
  }

  listTables(): string[] {
    const rows = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  close(): void {
    this.db.close();
  }
}
