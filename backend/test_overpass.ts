import axios from 'axios';

async function testOverpass() {
    const lat = 37.738;
    const lng = 127.033;
    const radius = 200; // meters
    
    const query = `
        [out:json][timeout:25];
        (
          way["highway"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
    `;
    
    try {
        console.log('Fetching roads from Overpass...');
        const response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`);
        console.log('Success! Found elements:', response.data.elements.length);
        // console.log(JSON.stringify(response.data.elements.slice(0, 5), null, 2));
    } catch (err: any) {
        console.error('Error fetching from Overpass:', err.message);
    }
}

testOverpass();
