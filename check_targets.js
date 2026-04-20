const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/data.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- 타겟 데이터 확인 시작 ---');

db.all('SELECT count(*) as count FROM convenience_stores WHERE is_target = 1', [], (err, rows) => {
    console.log('편의점 중 타겟 지정 수:', rows ? rows[0].count : 'N/A');
});

db.all('SELECT count(*) as count FROM tobacco_shops WHERE is_target = 1', [], (err, rows) => {
    console.log('담배소매인 중 타겟 지정 수:', rows ? rows[0].count : 'N/A');
});

db.all('SELECT count(*) as count FROM target_points', [], (err, rows) => {
    console.log('직접 등록한 타겟(target_points) 수:', rows ? rows[0].count : 'N/A');
    if (rows && rows[0].count > 0) {
        db.all('SELECT name, lat, lng FROM target_points LIMIT 5', [], (err, targets) => {
            console.log('상위 5개 타겟:', targets);
        });
    }
});

setTimeout(() => db.close(), 2000);
