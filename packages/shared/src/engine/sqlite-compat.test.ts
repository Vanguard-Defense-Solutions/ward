import { describe, it, expect, afterEach } from 'vitest';
import { openDatabase, type SQLiteDB } from './sqlite-compat';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('sqlite-compat', () => {
  let db: SQLiteDB;
  let tmpDir: string;

  function createTempDB(): SQLiteDB {
    tmpDir = mkdtempSync(join(tmpdir(), 'ward-sqlite-test-'));
    const dbPath = join(tmpDir, 'test.db');
    db = openDatabase(dbPath);
    return db;
  }

  afterEach(() => {
    try {
      db?.close();
    } catch {
      // already closed
    }
    // Windows holds SQLite WAL file locks briefly after close
    if (tmpDir) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore EBUSY — OS will clean up temp dir
      }
    }
  });

  it('opens a database and returns an object with the expected interface', () => {
    createTempDB();
    expect(db).toBeDefined();
    expect(typeof db.prepare).toBe('function');
    expect(typeof db.exec).toBe('function');
    expect(typeof db.close).toBe('function');
    expect(typeof db.transaction).toBe('function');
    expect(typeof db.getPragma).toBe('function');
  });

  it('exec() creates tables', () => {
    createTempDB();
    db.exec(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain('items');
  });

  it('prepare().run() inserts rows', () => {
    createTempDB();
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    db.prepare('INSERT INTO items (name) VALUES (?)').run('alpha');
    db.prepare('INSERT INTO items (name) VALUES (?)').run('beta');

    const rows = db.prepare('SELECT * FROM items ORDER BY id').all() as {
      id: number;
      name: string;
    }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('alpha');
    expect(rows[1].name).toBe('beta');
  });

  it('prepare().get() returns a single row or undefined', () => {
    createTempDB();
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    db.prepare('INSERT INTO items (name) VALUES (?)').run('alpha');

    const row = db.prepare('SELECT * FROM items WHERE name = ?').get('alpha') as {
      id: number;
      name: string;
    };
    expect(row).toBeDefined();
    expect(row.name).toBe('alpha');

    const missing = db.prepare('SELECT * FROM items WHERE name = ?').get('nope');
    expect(missing == null).toBe(true); // bun:sqlite returns null, better-sqlite3 returns undefined
  });

  it('prepare().all() returns an array', () => {
    createTempDB();
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    db.prepare('INSERT INTO items (name) VALUES (?)').run('a');
    db.prepare('INSERT INTO items (name) VALUES (?)').run('b');
    db.prepare('INSERT INTO items (name) VALUES (?)').run('c');

    const rows = db.prepare('SELECT * FROM items ORDER BY id').all() as {
      id: number;
      name: string;
    }[];
    expect(rows).toHaveLength(3);
  });

  it('transaction() wraps multiple inserts atomically', () => {
    createTempDB();
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');

    const insert = db.prepare('INSERT INTO items (name) VALUES (?)');
    const tx = db.transaction((names: string[]) => {
      for (const name of names) {
        insert.run(name);
      }
    });
    tx(['x', 'y', 'z']);

    const count = db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number };
    expect(count.cnt).toBe(3);
  });

  it('close() makes subsequent operations fail', () => {
    createTempDB();
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    db.close();

    expect(() => {
      db.prepare('SELECT 1').get();
    }).toThrow();
  });

  it('getPragma() returns pragma values', () => {
    createTempDB();
    db.prepare('PRAGMA journal_mode = WAL').run();
    const mode = db.getPragma('journal_mode');
    expect(mode.toLowerCase()).toBe('wal');
  });

  it('getPragma() rejects invalid pragma names', () => {
    createTempDB();
    expect(() => db.getPragma('DROP TABLE foo')).toThrow('Invalid pragma name');
    expect(() => db.getPragma('journal_mode; --')).toThrow('Invalid pragma name');
  });

  it('works with an in-memory database via :memory:', () => {
    db = openDatabase(':memory:');
    tmpDir = ''; // nothing to clean up
    db.exec('CREATE TABLE t (v TEXT)');
    db.prepare('INSERT INTO t (v) VALUES (?)').run('hello');
    const row = db.prepare('SELECT v FROM t').get() as { v: string };
    expect(row.v).toBe('hello');
  });
});
