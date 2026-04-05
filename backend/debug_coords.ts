import { db, initDb, getQuery } from './src/database';

async function debugCoords() {
    await initDb();
    const stores = await getQuery('SELECT name, lat, lng FROM convenience_stores LIMIT 5');
    const tobacco = await getQuery('SELECT name, lat, lng FROM tobacco_shops LIMIT 5');
    console.log('--- Convenience Stores ---');
    console.table(stores);
    console.log('--- Tobacco Shops ---');
    console.table(tobacco);
    process.exit(0);
}

debugCoords();
