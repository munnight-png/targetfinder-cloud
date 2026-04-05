import proj4 from 'proj4';

// User Example
const inputX = 203122.707;
const inputY = 470152.1436;
const expectedLat = 37.733829;
const expectedLng = 127.036211;

// User's provided string
const epsg5174_user = "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43";

const [lng, lat] = proj4(epsg5174_user, 'EPSG:4326', [inputX, inputY]);

console.log(`Input: ${inputX}, ${inputY}`);
console.log(`Expected: Lat ${expectedLat}, Lng ${expectedLng}`);
console.log(`Actual:   Lat ${lat}, Lng ${lng}`);
console.log(`Difference: Lat ${((lat - expectedLat) * 111000).toFixed(4)}m, Lng ${((lng - expectedLng) * 88000).toFixed(4)}m`);
