import dotenv from 'dotenv';
dotenv.config();

async function checkPermission() {
    const lat = 37.74422;
    const lng = 127.0315;
    const query = '의정부시청';
    
    const headers = {
        'X-NCP-APIGW-API-KEY-ID': process.env.NCP_CLIENT_ID || '',
        'X-NCP-APIGW-API-KEY': process.env.NCP_CLIENT_SECRET || '',
        'Referer': 'http://localhost:5173'
    };

    console.log('--- Checking Geocoding (Search) ---');
    try {
        const res = await fetch(`https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`, { headers });
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Geocoding Result:', JSON.stringify(data, null, 2));
    } catch (e) { console.error('Geocoding fetch error'); }

    console.log('\n--- Checking Reverse Geocoding (Click) ---');
    try {
        const response = await fetch(`https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=addr&output=json`, { headers });
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Reverse Geocoding Result:', JSON.stringify(data, null, 2));
    } catch (err) { console.error('Reverse Geocoding fetch error'); }
}

checkPermission();
