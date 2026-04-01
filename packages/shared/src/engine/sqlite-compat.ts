/**
 * Runtime-detecting SQLite compatibility layer.
 *
 * Under bun  -> uses the built-in `bun:sqlite` module (zero extra deps).
 * Under Node -> uses `better-sqlite3` (native addon, installed as optional dep).
 *
 * Both expose a near-identical synchronous API; this module papers over the
 * small differences so the rest of the codebase can stay runtime-agnostic.
 */

/* ------------------------------------------------------------------ */
/*  Public interface                                                   */
/* ------------------------------------------------------------------ */

export interface SQLiteStatement {
  get(...params: any[]): any;
  run(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface SQLiteDB {
  prepare(sql: string): SQLiteStatement;
  exec(sql: string): void;
  close(): void;
  transaction<T>(fn: (args: T) => void): (args: T) => void;
  /** Runtime-aware PRAGMA helper. */
  getPragma(name: string): string;
}

/* ------------------------------------------------------------------ */
/*  Runtime detection                                                  */
/* ------------------------------------------------------------------ */

const isBun = typeof (globalThis as any).Bun !== 'undefined';

/* ------------------------------------------------------------------ */
/*  Bun wrapper                                                        */
/* ------------------------------------------------------------------ */

function openBunDatabase(filepath: string): SQLiteDB {
  // Dynamic require so Node.js never tries to resolve the specifier.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Database } = require('bun:sqlite');
  const db = new Database(filepath);

  return {
    prepare(sql: string): SQLiteStatement {
      const stmt = db.prepare(sql);
      return {
        get(...params: any[]) {
          return stmt.get(...params);
        },
        run(...params: any[]) {
          return stmt.run(...params);
        },
        all(...params: any[]) {
          return stmt.all(...params);
        },
      };
    },

    exec(sql: string): void {
      db.exec(sql);
    },

    close(): void {
      db.close();
    },

    transaction<T>(fn: (args: T) => void): (args: T) => void {
      return db.transaction(fn);
    },

    getPragma(name: string): string {
      if (!/^[a-z_]+$/.test(name)) {
        throw new Error(`Invalid pragma name: ${name}`);
      }
      const result = db.query(`PRAGMA ${name}`).get() as Record<string, unknown> | null;
      if (result) {
        return String(Object.values(result)[0]);
      }
      return '';
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Node.js (better-sqlite3) wrapper                                   */
/* ------------------------------------------------------------------ */

function openNodeDatabase(filepath: string): SQLiteDB {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3');
  const db = new Database(filepath);

  return {
    prepare(sql: string): SQLiteStatement {
      const stmt = db.prepare(sql);
      return {
        get(...params: any[]) {
          return stmt.get(...params);
        },
        run(...params: any[]) {
          return stmt.run(...params);
        },
        all(...params: any[]) {
          return stmt.all(...params);
        },
      };
    },

    exec(sql: string): void {
      db.exec(sql);
    },

    close(): void {
      db.close();
    },

    transaction<T>(fn: (args: T) => void): (args: T) => void {
      return db.transaction(fn);
    },

    getPragma(name: string): string {
      if (!/^[a-z_]+$/.test(name)) {
        throw new Error(`Invalid pragma name: ${name}`);
      }
      const result = db.pragma(`${name}`, { simple: true });
      return result != null ? String(result) : '';
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Public factory                                                     */
/* ------------------------------------------------------------------ */

/**
 * Open (or create) a SQLite database at `filepath`.
 *
 * Automatically picks the right driver for the current runtime.
 */
export function openDatabase(filepath: string): SQLiteDB {
  return isBun ? openBunDatabase(filepath) : openNodeDatabase(filepath);
}
