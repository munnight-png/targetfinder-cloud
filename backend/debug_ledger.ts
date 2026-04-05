import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function debug() {
    const lat = 37.74441905302043;
    const lng = 127.04349008510898;

    try {
        console.log('1. Naver Reverse Geocode...');
        const naverUrl = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=legalcode,addr&output=json`;
        const naverRes = await axios.get(naverUrl, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': process.env.NCP_CLIENT_ID || '',
                'X-NCP-APIGW-API-KEY': process.env.NCP_CLIENT_SECRET || ''
            }
        });
        console.log('Naver Result:', JSON.stringify(naverRes.data, null, 2));

        const naverData = naverRes.data;
        const legalResult = naverData.results.find((r: any) => r.name === 'legalcode');
        const addrResult = naverData.results.find((r: any) => r.name === 'addr');

        if (!legalResult || !addrResult) {
            console.error('Missing legalcode or addr results');
            return;
        }

        const fullCode = legalResult.code.id;
        const serviceKey = process.env.BUILDING_LEDGER_KEY;
        const sigunguCd = fullCode.substring(0, 5);
        const bjdongCd = fullCode.substring(5, 10);
        const land = addrResult.land;
        const bun = land.number1.padStart(4, '0');
        const ji = (land.number2 || '0').padStart(4, '0');

        console.log(`Query Params: sigunguCd=${sigunguCd}, bjdongCd=${bjdongCd}, bun=${bun}, ji=${ji}`);

        const params = `sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&platGbCd=0&bun=${bun}&ji=${ji}&numOfRows=1&pageNo=1&_type=json`;

        const tests = [
            { name: 'HUB Recap (HTTP, As-is)', url: `http://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo?serviceKey=${serviceKey}&${params}` },
            { name: 'HUB Title (HTTP, As-is)', url: `http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?serviceKey=${serviceKey}&${params}` },
            { name: 'V2 Title (HTTP, As-is)', url: `http://apis.data.go.kr/1613000/BldRgstService_v2/getBrTitleInfo?serviceKey=${serviceKey}&${params}` }
        ];

        for (const t of tests) {
            console.log(`\n--- Testing: ${t.name} ---`);
            try {
                const res = await axios.get(t.url, { timeout: 5000 });
                console.log('Result:', JSON.stringify(res.data).substring(0, 200));
            } catch (err: any) {
                console.log('Error:', err.response?.status, err.response?.data ? JSON.stringify(err.response.data).substring(0, 100) : err.message);
            }
        }

    } catch (err: any) {
        if (err.response) {
            console.error('Error Status:', err.response.status);
            console.error('Error Data:', err.response.data);
        } else {
            console.error('Error:', err.message);
        }
    }
}

debug();
