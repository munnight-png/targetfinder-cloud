import fs from 'fs';
import iconv from 'iconv-lite';
import csv from 'csv-parser';

async function findActive() {
    const s = fs.createReadStream('fulldata_11_43_02_P_담배소매업.csv')
        .pipe(iconv.decodeStream('cp949'))
        .pipe(csv({headers:false}));

    let c = 0;
    for await (const r of s) {
        if (r[8] === '영업/정상' || r[7] === '01') {
            console.log('--- FOUND ACTIVE ---');
            console.log(JSON.stringify(r, null, 2));
            process.exit();
        }
        c++;
        if (c > 100000) {
            console.log('Not found in 100k');
            process.exit();
        }
    }
}
findActive();
