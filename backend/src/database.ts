import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../data.sqlite');
export const db = new sqlite3.Database(dbPath);

export async function initDb(drop: boolean = false) {
  if (drop) {
    await runQuery('DROP TABLE IF EXISTS convenience_stores');
    await runQuery('DROP TABLE IF EXISTS tobacco_shops');
    console.log('Tables dropped for schema reset');
  }
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // 편의점 (브랜드 G, C, S, E, P)
      db.run(`CREATE TABLE IF NOT EXISTS convenience_stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_code TEXT,
        name TEXT,
        address TEXT,
        jibun_address TEXT,
        road_address TEXT,
        lat REAL,
        lng REAL,
        origin_lat REAL,
        origin_lng REAL,
        designation_date TEXT,
        expiration_date TEXT,
        license_type TEXT,
        tmX REAL,
        tmY REAL,
        is_geocoded INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 담배소매인
      db.run(`CREATE TABLE IF NOT EXISTS tobacco_shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        address TEXT,
        jibun_address TEXT,
        road_address TEXT,
        designation_date TEXT,
        expiration_date TEXT,
        license_type TEXT,
        tmX REAL,
        tmY REAL,
        lat REAL,
        lng REAL,
        origin_lat REAL,
        origin_lng REAL,
        is_target INTEGER DEFAULT 0,
        is_geocoded INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 타겟 포인트 (후보지)
      db.run(`CREATE TABLE IF NOT EXISTS target_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        address TEXT,
        area_size REAL,
        rent_fee REAL,
        memo TEXT,
        lat REAL,
        lng REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 범용 메모
      db.run(`CREATE TABLE IF NOT EXISTS entity_memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT, -- 'store', 'tobacco', 'target'
        entity_id INTEGER,
        memo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, async () => {
        // 컬럼 추가 마이그레이션 (기존 테이블이 있는 경우 대응)
        try { await runQuery('ALTER TABLE convenience_stores ADD COLUMN origin_lat REAL'); } catch(e) {}
        try { await runQuery('ALTER TABLE convenience_stores ADD COLUMN origin_lng REAL'); } catch(e) {}
        try { await runQuery('ALTER TABLE tobacco_shops ADD COLUMN origin_lat REAL'); } catch(e) {}
        try { await runQuery('ALTER TABLE tobacco_shops ADD COLUMN origin_lng REAL'); } catch(e) {}
        try { await runQuery('ALTER TABLE convenience_stores ADD COLUMN is_target INTEGER DEFAULT 0'); } catch(e) {}
        try { await runQuery('ALTER TABLE tobacco_shops ADD COLUMN is_target INTEGER DEFAULT 0'); } catch(e) {}
        resolve();
      });
    });
  });
};

export const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const getQuery = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};
