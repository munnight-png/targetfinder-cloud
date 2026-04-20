const sqlite3 = require('./node_modules/sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- DB 경로:', dbPath);

db.serialize(() => {
    db.all('SELECT count(*) as count FROM convenience_stores WHERE is_target = 1', [], (err, rows) => {
        if (err) console.error('Error (stores):', err);
        else console.log('편의점 중 타겟 지정 수:', rows[0].count);
    });

    db.all('SELECT count(*) as count FROM tobacco_shops WHERE is_target = 1', [], (err, rows) => {
        if (err) console.error('Error (tobacco):', err);
        else console.log('담배소매인 중 타겟 지정 수:', rows[0].count);
    });

    db.all('SELECT count(*) as count FROM target_points', [], (err, rows) => {
        if (err) console.error('Error (targets):', err);
        else {
            console.log('직접 등록한 타겟(target_points) 수:', rows[0].count);
            if (rows[0].count > 0) {
                db.all('SELECT name, lat, lng FROM target_points LIMIT 10', [], (err, targets) => {
                    console.log('등록된 타겟 리스트:', targets);
                });
            }
        }
    });
});

setTimeout(() => db.close(), 1000);
