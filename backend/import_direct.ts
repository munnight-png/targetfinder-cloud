import { execSync } from 'child_process';
import { initDb, runQuery } from './src/database';
import proj4 from 'proj4';
import iconv from 'iconv-lite';

async function importDirect() {
    console.log('Direct Ingestion Pass 7.1...');
    await initDb(true);
    await runQuery('DELETE FROM convenience_stores');
    await runQuery('DELETE FROM tobacco_shops');

    console.log('Running PowerShell filter...');
    const cmd = `powershell -Command "Get-Content 'fulldata_11_43_02_P_담배소매업.csv' -Encoding Default | Select-String '영업/정상' | Select-String '의정부' | ForEach-Object { $_.Line }"`;
    const buffer = execSync(cmd, { maxBuffer: 1024 * 1024 * 100 }); 
    
    const content = iconv.decode(buffer, 'cp949');
    const lines = content.split(/\r?\n/);
    console.log(`Processing ${lines.length} lines from PS...`);

    const brands = [
        { code: 'G', names: ['지에스25', 'GS25', '지에스(GS)25', '지에에25(GS25)'] },
        { code: 'C', names: ['씨유', 'CU', '씨유(CU)', '(주)비지에프리테일'] },
        { code: 'S', names: ['세븐일레븐', '(주)코리아세븐', '미니스톱'] },
        { code: 'E', names: ['이마트24', 'emart24'] },
        { code: 'P', names: ['씨스페이스', 'C-SPACE'] }
    ];

    const mapLicenseType = (type: string) => {
        if (!type || type === '""') return '일반소매인';
        if (type.includes('제7조의3제2항')) return '일반소매인';
        if (type.includes('제7조의3제3항')) return '구내소매인';
        if (type.includes('2009년11월')) return '2009년11월이전 소매인';
        return type.replace(/"/g, '');
    };

    let imported = 0;
    await runQuery('BEGIN TRANSACTION');
    for (let line of lines) {
        if (!line.trim()) continue;
        
        // Remove Select-String prefix if present
        const index = line.indexOf(': "');
        if (index !== -1) {
            line = line.substring(index + 2);
        } else {
            const index2 = line.indexOf(':"');
            if (index2 !== -1) line = line.substring(index2 + 1);
        }

        const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (row.length < 20) continue;

        const designationDate = row[5]?.replace(/"/g, '').trim();
        const statusCode = row[7]?.replace(/"/g, '').trim();
        const statusName = row[8]?.replace(/"/g, '').trim();
        const roadAddr = row[19]?.replace(/"/g, '').trim();
        const jibunAddr = row[18]?.replace(/"/g, '').trim();
        const storeName = row[21]?.replace(/"/g, '').trim();
        const tmX = parseFloat(row[26]?.replace(/"/g, ''));
        const tmY = parseFloat(row[27]?.replace(/"/g, ''));
        const rawLicense = row[29]?.replace(/"/g, '').trim();
        
        const finalAddr = roadAddr || jibunAddr;
        const licenseType = mapLicenseType(rawLicense);

        const isActive = (statusName === '영업/정상' || statusCode === '01');
        const isUijeongbu = finalAddr && finalAddr.includes('의정부');

        if (isActive && isUijeongbu) {
            let brandCode = null;
            for (const b of brands) {
                if (storeName && b.names.some(n => storeName.toUpperCase().includes(n.toUpperCase()))) {
                    brandCode = b.code;
                    break;
                }
            }

            let lat = null, lng = null;
            if (tmX && tmY) {
                // Fixed: Official EPSG:5174 (Modified Central Belt) for Naver Maps
                const epsg5174 = "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43";
                const [wLng, wLat] = proj4(epsg5174, 'EPSG:4326', [tmX, tmY]);
                lat = wLat;
                lng = wLng;
            }

            let expirationDate = '';
            if (designationDate && designationDate.includes('-')) {
                const d = new Date(designationDate);
                d.setFullYear(d.getFullYear() + 5);
                d.setDate(d.getDate() - 1);
                expirationDate = d.toISOString().split('T')[0];
            }

            try {
                if (brandCode) {
                    await runQuery(`INSERT INTO convenience_stores (brand_code, name, address, jibun_address, road_address, lat, lng, designation_date, expiration_date, license_type, tmX, tmY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [brandCode, storeName, finalAddr, jibunAddr, roadAddr, lat, lng, designationDate, expirationDate, licenseType, tmX, tmY]);
                } else {
                    await runQuery(`INSERT INTO tobacco_shops (name, address, jibun_address, road_address, designation_date, expiration_date, license_type, lat, lng, tmX, tmY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [storeName, finalAddr, jibunAddr, roadAddr, designationDate, expirationDate, licenseType, lat, lng, tmX, tmY]);
                }
                imported++;
            } catch (e) {
                console.error('Import error:', e);
            }
        }
    }
    await runQuery('COMMIT');
    console.log(`Successfully imported ${imported} records!`);
}

importDirect().catch(console.error);
