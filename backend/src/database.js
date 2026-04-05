"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuery = exports.runQuery = exports.db = void 0;
exports.initDb = initDb;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const dbPath = process.env.DB_PATH || path_1.default.resolve(__dirname, '../data.sqlite');
exports.db = new sqlite3_1.default.Database(dbPath);
function initDb() {
    return __awaiter(this, arguments, void 0, function* (drop = false) {
        if (drop) {
            yield (0, exports.runQuery)('DROP TABLE IF EXISTS convenience_stores');
            yield (0, exports.runQuery)('DROP TABLE IF EXISTS tobacco_shops');
            console.log('Tables dropped for schema reset');
        }
        return new Promise((resolve, reject) => {
            exports.db.serialize(() => {
                // 편의점 (브랜드 G, C, S, E, P)
                exports.db.run(`CREATE TABLE IF NOT EXISTS convenience_stores (
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
                exports.db.run(`CREATE TABLE IF NOT EXISTS tobacco_shops (
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
                exports.db.run(`CREATE TABLE IF NOT EXISTS target_points (
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
                exports.db.run(`CREATE TABLE IF NOT EXISTS entity_memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT, -- 'store', 'tobacco', 'target'
        entity_id INTEGER,
        memo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, () => __awaiter(this, void 0, void 0, function* () {
                    // 컬럼 추가 마이그레이션 (기존 테이블이 있는 경우 대응)
                    try {
                        yield (0, exports.runQuery)('ALTER TABLE convenience_stores ADD COLUMN origin_lat REAL');
                    }
                    catch (e) { }
                    try {
                        yield (0, exports.runQuery)('ALTER TABLE convenience_stores ADD COLUMN origin_lng REAL');
                    }
                    catch (e) { }
                    try {
                        yield (0, exports.runQuery)('ALTER TABLE tobacco_shops ADD COLUMN origin_lat REAL');
                    }
                    catch (e) { }
                    try {
                        yield (0, exports.runQuery)('ALTER TABLE tobacco_shops ADD COLUMN origin_lng REAL');
                    }
                    catch (e) { }
                    try {
                        yield (0, exports.runQuery)('ALTER TABLE convenience_stores ADD COLUMN is_target INTEGER DEFAULT 0');
                    }
                    catch (e) { }
                    try {
                        yield (0, exports.runQuery)('ALTER TABLE tobacco_shops ADD COLUMN is_target INTEGER DEFAULT 0');
                    }
                    catch (e) { }
                    resolve();
                }));
            });
        });
    });
}
;
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve(this);
        });
    });
};
exports.runQuery = runQuery;
const getQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
exports.getQuery = getQuery;
