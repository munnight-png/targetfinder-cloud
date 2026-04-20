import express from 'express';
import path from 'path';
import cors from 'cors';
import { initDb, getQuery, runQuery } from './database';
import { 
  createRestrictedArea, createAvailableArea, initRoadGraph, 
  clearAreaCache 
} from './gisUtils';
import dotenv from 'dotenv';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

dotenv.config();

const app = express();
app.use(cors()); // 운영 환경 배포를 위해 모든 도메인 허용
app.use(express.json());

// Request Logger Middleware (Enhanced)
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url} - Auth: ${req.headers['authorization'] ? 'Yes' : 'No'}`);
  next();
});

app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API Server is Up', time: new Date().toISOString() });
});

// 🔓 Login route MUST be registered BEFORE auth middleware
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const masterPassword = (process.env.MASTER_PASSWORD || '1234').trim();
    
    if (password === masterPassword) {
        console.log(`[AUTH] Login Success from ${req.ip}`);
        res.json({ success: true, message: 'Authenticated' });
    } else {
        console.warn(`[AUTH] Login Failed from ${req.ip}. Pwd: "${password}" (len: ${password?.length}), Expected len: ${masterPassword.length}`);
        res.status(401).json({ success: false, message: 'Invalid Password' });
    }
});

// 🔐 Auth Middleware: Master Password Check (applied to all OTHER /api routes)
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const masterPassword = (process.env.MASTER_PASSWORD || '1234').trim();
    const clientAuth = req.headers['authorization'];

    if (clientAuth === masterPassword) {
        next();
    } else {
        console.warn(`[AUTH] Unauthorized access attempt from ${req.ip}. Expected length: ${masterPassword.length}, Received length: ${clientAuth?.length || 0}`);
        res.status(401).json({ error: 'Unauthorized: Invalid Master Password' });
    }
};

// Apply security to all /api routes (login is already handled above)
app.use('/api', authMiddleware);

async function startServer() {
  try {
    console.log('[SYSTEM] Starting server sequence...');
    await initDb();
    console.log('[SYSTEM] Database initialized.');
    
    // Migration
    await runQuery('UPDATE convenience_stores SET origin_lat = lat, origin_lng = lng WHERE origin_lat IS NULL');
    await runQuery('UPDATE tobacco_shops SET origin_lat = lat, origin_lng = lng WHERE origin_lat IS NULL');

    // Serve
    const port = process.env.PORT || 3001;
    const server = app.listen(Number(port), '0.0.0.0', () => {
      console.log('--------------------------------------------------');
      console.log(`🚀 BACKEND RUNNING AT http://0.0.0.0:${port} (Ver 1.1)`);
      console.log('--------------------------------------------------');
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error('❌ PORT 3001 IS ALREADY IN USE! Please kill existing node processes.');
        process.exit(1);
      }
    });

    // Background task
    initRoadGraph().catch(e => console.error('[GIS] Background init failed:', e.message));

  } catch (err: any) {
    console.error('❌ CRITICAL STARTUP ERROR:', err.message);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err.message);
});

// startServer() call moved to the end

// API Routes

// API Routes
app.get('/api/stores', async (req, res) => {
  const stores = await getQuery('SELECT * FROM convenience_stores');
  res.json(stores);
});

app.get('/api/tobacco', async (req, res) => {
  const shops = await getQuery('SELECT * FROM tobacco_shops');
  res.json(shops);
});

app.get('/api/targets', async (req, res) => {
  const targets = await getQuery('SELECT * FROM target_points');
  res.json(targets);
});

app.post('/api/targets', async (req, res) => {
  const { name, address, area_size, rent_fee, memo, lat, lng } = req.body;
  const result = await runQuery(
    `INSERT INTO target_points (name, address, area_size, rent_fee, memo, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, address, area_size, rent_fee, memo, lat, lng]
  );
  res.json({ success: true, id: result.lastID });
});

app.delete('/api/targets/:id', async (req, res) => {
    await runQuery(`DELETE FROM target_points WHERE id=?`, [req.params.id]);
    res.json({ success: true });
});

app.post('/api/memos', async (req, res) => {
  const { entity_type, entity_id, memo } = req.body;
  await runQuery(`INSERT INTO entity_memos (entity_type, entity_id, memo) VALUES (?, ?, ?)`, [entity_type, entity_id, memo]);
  res.json({ success: true });
});

app.get('/api/memos', async (req, res) => {
    const { type, id } = req.query;
    const memos = await getQuery(`SELECT * FROM entity_memos WHERE entity_type=? AND entity_id=? ORDER BY id DESC`, [type, id]);
    res.json(memos);
});

app.put('/api/memos/:id', async (req, res) => {
    const { memo } = req.body;
    await runQuery(`UPDATE entity_memos SET memo=? WHERE id=?`, [memo, req.params.id]);
    res.json({ success: true });
});

app.delete('/api/memos/:id', async (req, res) => {
    await runQuery(`DELETE FROM entity_memos WHERE id=?`, [req.params.id]);
    res.json({ success: true });
});

app.get('/api/areas', async (req, res) => {
  try {
    const { mode } = req.query; // 'on' | 'invert'
    const allStores = await getQuery("SELECT name, lat, lng FROM convenience_stores WHERE lat IS NOT NULL AND lng IS NOT NULL");
    const stores = allStores.filter((s: any) => !(s.name || '').includes('폐점'));
    const tobacco = await getQuery('SELECT name, lat, lng FROM tobacco_shops WHERE lat IS NOT NULL AND lng IS NOT NULL');
    
    const brandedTobacco = tobacco.filter(sh => {
        const n = sh.name || '';
        if (n.includes('폐점')) return false;
        const hasBrand = n.includes('지에스') || n.includes('GS') || n.includes('gs') || 
                         n.includes('CU') || n.includes('씨유') || 
                         n.includes('세븐') || n.includes('seven') ||
                         n.includes('이마트') || n.includes('emart') || n.includes('Emart') ||
                         n.includes('씨스페이스');
        if (!hasBrand) return false;

        const excludes = ['공인중개사', '부동산', '주유소', '셀프', '정비', '카센타', '마트', '슈퍼'];
        if (excludes.some(k => n.includes(k))) {
            return n.includes('25') || n.includes('24') || n.includes('편의점');
        }
        return true;
    }).map(sh => ({ lat: sh.lat, lng: sh.lng }));

    const allPoints = [...stores, ...brandedTobacco];
    const limitPoints = allPoints.slice(0, 2000); 

    console.log(`[API] /api/areas - mode: ${mode}`);

    if (mode === 'invert') {
        const availableArea = createAvailableArea(limitPoints);
        res.json(availableArea);
    } else {
        const restrictedArea = createRestrictedArea(limitPoints);
        res.json(restrictedArea);
    }
  } catch (err) {
    console.error('Error calculating areas:', err);
    res.status(500).json({ error: 'Failed to calculate areas' });
  }
});

app.get('/api/stats', async (req, res) => {
  const storeRows = await getQuery("SELECT brand_code, count(*) as cnt, sum(case when expiration_date <= '2027-12-31' then 1 else 0 end) as exp_cnt FROM convenience_stores WHERE name NOT LIKE '%폐점%' GROUP BY brand_code");
  const tobacco = await getQuery("SELECT name FROM tobacco_shops");

  // 브랜드화된 담배소매인 집계 (상호명 기반)
  const tobaccoStats: Record<string, number> = {};
  tobacco.forEach(sh => {
    const n = sh.name || '';
    if (n.includes('폐점')) return;
    let bc = null;
    const isExcl = ['공인중개사', '부동산', '주유소', '셀프', '정비', '카센타', '마트', '슈퍼'].some(k => n.includes(k));
    const isExpl = n.includes('25') || n.includes('24') || n.includes('편의점');
    
    if (isExcl && !isExpl) return;

    if (n.includes('CU') || n.includes('씨유')) bc = 'C';
    else if (n.includes('지에스') || n.includes('GS') || n.includes('gs')) bc = 'G';
    else if (n.includes('세븐')) bc = 'S';
    else if (n.includes('이마트')) bc = 'E';
    else if (n.includes('씨스페이스')) bc = 'P';
    
    if (bc) tobaccoStats[bc] = (tobaccoStats[bc] || 0) + 1;
  });

  // 기존 편의점 데이터와 합산
  const mergedMap = new Map();
  storeRows.forEach(r => mergedMap.set(r.brand_code, { count: r.cnt, expireCount: r.exp_cnt }));
  
  for (const [bc, count] of Object.entries(tobaccoStats)) {
    const existing = mergedMap.get(bc) || { count: 0, expireCount: 0 };
    mergedMap.set(bc, { count: existing.count + count, expireCount: existing.expireCount });
  }

  // 타겟(Target) 후보지 개수 추가
  const targetCountRes = await getQuery("SELECT count(*) as cnt FROM targets");
  const targetCount = targetCountRes[0]?.cnt || 0;

  const totalStores = Array.from(mergedMap.values()).reduce((acc, row) => acc + row.count, 0);
  
  const brandNames: Record<string, string> = {
    'C': 'CU',
    'G': 'GS25',
    'E': 'emart24',
    'S': '세븐일레븐',
    'P': '씨스페이스'
  };

  const stats = Array.from(mergedMap.entries()).map(([bc, data]) => {
    const code = String(bc || '').trim().toUpperCase();
    return {
      brand: brandNames[code] || brandNames[bc] || bc,
      count: data.count,
      ms: totalStores > 0 ? ((data.count / totalStores) * 100).toFixed(1) : 0,
      expireCount: data.expireCount
    };
  });

  // '타겟' 항목 추가 (M/S 계산 제외 또는 0으로 표기)
  stats.push({
    brand: '타겟',
    count: targetCount,
    ms: '0.0', // 타겟은 점유율 계산에서 제외하거나 0으로 표기
    expireCount: 0
  });

  res.json(stats);
});

app.get('/api/reverse-geocode', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat/Lng required' });

    try {
        const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=addr,roadaddr&output=json`;
        const response = await axios.get(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': process.env.NCP_CLIENT_ID || '',
                'X-NCP-APIGW-API-KEY': process.env.NCP_CLIENT_SECRET || ''
            }
        });
        
        const data = response.data;
        let address = '';
        if (data.results && data.results.length > 0) {
            const r = data.results[0];
            const region = r.region;
            address = [region.area1.name, region.area2.name, region.area3.name, region.area4.name].filter(v => !!v).join(' ');
            if (r.land && r.land.number1) address += ` ${r.land.number1}${r.land.number2 ? '-' + r.land.number2 : ''}`;
        }
        res.json({ address: address || '주소를 찾을 수 없습니다.' });
    } catch (err) {
        console.error('Reverse geocode proxy error:', err);
        res.status(500).json({ error: 'Reverse geocode failed' });
    }
});

// Street View Thumbnail Proxy (Precision Fixed & Detail Logging)
app.get('/api/pano-proxy', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat/Lng required' });

    // Truncate lat/lng to 6 decimals (Naver API safety)
    const tLat = parseFloat(lat as string).toFixed(6);
    const tLng = parseFloat(lng as string).toFixed(6);

    try {
        const url = `https://map.naver.com/p/api/street-view/thumbnail?lat=${tLat}&lng=${tLng}&fov=120&pitch=0&heading=0`;
        console.log(`[PANO PROXY] Fetching: ${url}`);

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 5000,
            headers: {
                'Referer': 'https://map.naver.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(response.data);
    } catch (err: any) {
        console.error(`[PANO PROXY] ERROR at ${lat}, ${lng}:`, err.message);
        // Fallback: Return a 1x1 transparent gif to avoid 500 error in frontend
        res.set('Content-Type', 'image/gif');
        res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
    }
});

app.post('/api/stores/update-coords', async (req, res) => {
    const { id, lat, lng } = req.body;
    await runQuery(`UPDATE convenience_stores SET lat=?, lng=? WHERE id=?`, [lat, lng, id]);
    clearAreaCache();
    res.json({ success: true });
});

// 🏢 건축물대장(위반건축물) 조회 프록시
app.get('/api/building-ledger', async (req, res) => {
    const { lat, lng, sigunguCd: pSigungu, bjdongCd: pBjdong, bun: pBun, ji: pJi } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat/Lng required' });

    try {
        let sigunguCd = pSigungu as string;
        let bjdongCd = pBjdong as string;
        let bun = (pBun as string) || '0000';
        let ji = (pJi as string) || '0000';

        // 1. 프론트엔드에서 코드를 주지 않은 경우에만 네이버 역지오코딩 호출 (백엔드 401 우회용)
        if (!sigunguCd || !bjdongCd) {
            console.log(`[LEDGER] No codes provided, calling Naver Reverse Geocode...`);
            const naverUrl = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=legalcode,addr&output=json`;
            const naverRes = await axios.get(naverUrl, {
                headers: {
                    'X-NCP-APIGW-API-KEY-ID': process.env.NCP_CLIENT_ID || '',
                    'X-NCP-APIGW-API-KEY': process.env.NCP_CLIENT_SECRET || ''
                }
            });

            const naverData = naverRes.data;
            if (!naverData.results || naverData.results.length === 0) {
                return res.json({ success: false, message: '주소 정보를 찾을 수 없습니다.' });
            }

            const legalResult = naverData.results.find((r: any) => r.name === 'legalcode');
            const addrResult = naverData.results.find((r: any) => r.name === 'addr');

            if (!legalResult || !legalResult.code?.id) {
                return res.json({ success: false, message: '행정동 코드를 확보할 수 없습니다.' });
            }

            const fullCode = legalResult.code.id;
            sigunguCd = fullCode.substring(0, 5);
            bjdongCd = fullCode.substring(5, 10);
            
            if (addrResult?.land) {
                bun = (addrResult.land.number1 || '').padStart(4, '0');
                ji = (addrResult.land.number2 || '0').padStart(4, '0');
            }
        } else {
            console.log(`[LEDGER] Using codes from frontend: ${sigunguCd}-${bjdongCd} ${bun}-${ji}`);
        }

        // 2. 공공데이터포털 건축HUB 서비스 조회
        const serviceKey = process.env.BUILDING_LEDGER_KEY;
        if (!serviceKey) return res.json({ success: false, message: 'API 인증키 누락' });

        const hubBaseUrl = `https://apis.data.go.kr/1613000/BldRgstHubService`;
        const endpoints = [
            'getBrRecapTitleInfo', // 1순위: 총괄표제부 (단지 전체)
            'getBrTitleInfo',      // 2순위: 표제부 (동별 정보)
            'getBrBasisInfo'       // 3순위: 일반건축물 기본정보 (일반 건축물 등)
        ];
        
        let allItems: any[] = [];
        let lastError: any = null;

        for (const endpoint of endpoints) {
            const publicUrl = `${hubBaseUrl}/${endpoint}?serviceKey=${serviceKey}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&platGbCd=0&bun=${bun}&ji=${ji}&numOfRows=100&pageNo=1&_type=json`;
            console.log(`[LEDGER] [${endpoint}] Requesting...`);
            
            try {
                const response = await axios.get(publicUrl, { timeout: 10000 });
                const data = response.data;
                
                if (data.response?.header?.resultCode === '00' && data.response?.body?.items?.item) {
                    const itemData = data.response.body.items.item;
                    const items = Array.isArray(itemData) ? itemData : [itemData];
                    allItems = [...allItems, ...items];
                    console.log(`[LEDGER] [${endpoint}] Found ${items.length} items.`);
                } else if (data.response?.header?.resultCode) {
                    lastError = data.response.header.resultMsg || data.response.header.resultCode;
                }
            } catch (err: any) {
                lastError = err.message;
            }
        }

        if (allItems.length === 0) {
            return res.json({ success: false, message: lastError || '건축물대장 정보가 없습니다.' });
        }

        // 3. 모든 아이템을 대상으로 위반 여부 전수 조사
        let isViolationFound = false;
        let detectedField = '';
        let detectedValue = '';
        const keywords = ['vlato', 'violation', 'viol', 'illegal', '위반', '불법', 'ilgl'];

        // 디버깅: 첫 번째 아이템의 전체 필드 로깅 (1회)
        if (allItems.length > 0) {
            console.log(`[LEDGER] DEBUG: First item keys: ${Object.keys(allItems[0]).join(', ')}`);
            console.log(`[LEDGER] DEBUG: First item full: ${JSON.stringify(allItems[0]).substring(0, 1000)}`);
        }

        for (const item of allItems) {
            const keys = Object.keys(item);
            for (const key of keys) {
                const lowerKey = key.toLowerCase();
                const val = String(item[key] || '').trim();

                // 1. 명시적 위반 필드 (vlatoBldYn 등) 체크
                if (lowerKey === 'vlatobldyn' || keywords.some(k => lowerKey.includes(k))) {
                    // 'Y', '1', '해당', '위반' 등 다양한 위반 상태 체크
                    if (['Y', '1', 'true', '해당', '위반'].includes(val)) {
                        isViolationFound = true;
                        detectedField = key;
                        detectedValue = val;
                        break; 
                    } else if (val && !['N', '0', 'false', '정상', '미해당', '적합'].includes(val)) {
                        // 미지의 값이 들어있는 경우 (예: 'Y' 이외의 다른 긍정 문자열)
                        isViolationFound = true;
                        detectedField = key;
                        detectedValue = val;
                        break;
                    } else if (val) {
                        // 확실한 정상 값인 경우 필드명만 기억 (백업용)
                        if (detectedField === '') {
                            detectedField = key;
                            detectedValue = val;
                        }
                    }
                }
            }
            if (isViolationFound) break;
        }

        // 보조 체크: 필드를 발견하지 못했더라도 전체 필드 중 '위반' 혹은 '해당'이 있는지 한 번 더 확인 (매우 강력한 폴백)
        if (!isViolationFound) {
            for (const item of allItems) {
                for (const key in item) {
                    const val = String(item[key] || '').trim();
                    if (val === '위반' || val === '해당') {
                        isViolationFound = true;
                        detectedField = key;
                        detectedValue = val;
                        break;
                    }
                }
                if (isViolationFound) break;
            }
        }

        res.json({ 
            success: true, 
            building: {
                isViolation: isViolationFound,
                source: "Architectural HUB",
                totalItemsChecked: allItems.length,
                rawField: detectedField || 'Not Found',
                rawValue: detectedValue || 'N/A'
            }
        });

    } catch (err: any) {
        console.error('[LEDGER] Final Exception:', err.stack || err.message);
        const failedUrl = err.config?.url ? `(URL: ${err.config.url.split('serviceKey=')[0]}...)` : '';
        res.json({ success: false, message: `조회 오류: ${err.message} ${failedUrl}` });
    }
});

app.post('/api/entities/reset-coords', async (req, res) => {
    const { type, id } = req.body;
    const table = type === 'store' ? 'convenience_stores' : 'tobacco_shops';
    await runQuery(`UPDATE ${table} SET lat = origin_lat, lng = origin_lng WHERE id = ?`, [id]);
    const updated = await getQuery(`SELECT lat, lng FROM ${table} WHERE id = ?`, [id]);
    res.json({ success: true, coords: updated[0] });
});

app.post('/api/entities/update-name', async (req, res) => {
    const { type, id, name } = req.body;
    const table = type === 'store' ? 'convenience_stores' : 'tobacco_shops';
    await runQuery(`UPDATE ${table} SET name = ? WHERE id = ?`, [name, id]);
    res.json({ success: true });
});

app.post('/api/entities/toggle-target', async (req, res) => {
    const { type, id, is_target } = req.body;
    const table = type === 'store' ? 'convenience_stores' : 'tobacco_shops';
    await runQuery(`UPDATE ${table} SET is_target = ? WHERE id = ?`, [is_target ? 1 : 0, id]);
    res.json({ success: true });
});

// 🌐 Static File Serving & Fallback (MUST be at the end)
const publicPath = path.resolve(__dirname, '../../public'); // Docker context: /app/public
if (require('fs').existsSync(publicPath)) {
    console.log(`[SYSTEM] Public path found: ${publicPath}`);
    console.log(`[SYSTEM] Files in public: ${require('fs').readdirSync(publicPath).join(', ')}`);
} else {
    console.warn(`[SYSTEM] PUBLIC PATH NOT FOUND: ${publicPath}`);
    // Try fallback for different build contexts
    const altPath = path.resolve(__dirname, '../public');
    console.log(`[SYSTEM] Trying alt path: ${altPath}`);
    if (require('fs').existsSync(altPath)) console.log(`[SYSTEM] Alt path files: ${require('fs').readdirSync(altPath).join(', ')}`);
}

app.use(express.static(publicPath));
app.use(express.static(path.resolve(__dirname, '../public'))); // Extra insurance

// Unified Catch-all for SPA: Serve index.html for any route not starting with /api and not a file
app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
    }
    res.sendFile(path.join(require('fs').existsSync(publicPath) ? publicPath : path.resolve(__dirname, '../public'), 'index.html'));
});

startServer();
