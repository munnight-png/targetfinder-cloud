import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function debug() {
    const serviceKey = process.env.BUILDING_LEDGER_KEY;
    if (!serviceKey) {
        console.error('BUILDING_LEDGER_KEY is missing in .env');
        return;
    }

    // 의정부시 의정부동 힐스테이트 의정부역 근처 파라미터 (사용자 스크린샷 기반)
    const sigunguCd = '41150';
    const bjdongCd = '10900';
    const bun = '0316';
    const ji = '0000';
    const params = `sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&platGbCd=0&bun=${bun}&ji=${ji}&numOfRows=1&pageNo=1&_type=json`;

    const tests = [
        { name: 'HUB Title (HTTPS, As-is)', url: `https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?serviceKey=${serviceKey}&${params}` },
        { name: 'HUB Title (HTTP, As-is)', url: `http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?serviceKey=${serviceKey}&${params}` },
        { name: 'HUB Title (HTTPS, Encoded)', url: `https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?serviceKey=${encodeURIComponent(serviceKey)}&${params}` },
    ];

    console.log('--- Public Data API Registration / Encoding Test ---');
    console.log('Using Key:', serviceKey.substring(0, 10) + '...');

    for (const t of tests) {
        console.log(`\nTesting: ${t.name}`);
        try {
            const res = await axios.get(t.url, { timeout: 10000 });
            console.log('Result Status:', res.status);
            console.log('Result Code:', res.data.response?.header?.resultCode);
            console.log('Result Msg:', res.data.response?.header?.resultMsg);
            if (res.data.response?.body?.items?.item) {
                console.log('Item Found!');
            }
        } catch (err: any) {
            console.log('Error Status:', err.response?.status);
            console.log('Error Message:', err.message);
            if (err.response?.data) {
                console.log('Error Data:', JSON.stringify(err.response.data));
            }
        }
    }
}

debug();
