"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPointInBounds = exports.createRestrictedArea = exports.createAvailableArea = exports.clearAreaCache = exports.create100mIsochrone = exports.initRoadGraph = void 0;
const turf = __importStar(require("@turf/turf"));
const axios_1 = __importDefault(require("axios"));
const kdbush_1 = __importDefault(require("kdbush"));
// 의정부시 경계 폴리곤 (WGS84) - 단순화된 15개 지점
const UIJEONGBU_BOUNDARY_POINTS = [
    [127.032, 37.785], [127.050, 37.795], [127.075, 37.788], [127.100, 37.772], [127.122, 37.755],
    [127.128, 37.728], [127.115, 37.705], [127.085, 37.692], [127.055, 37.680], [127.025, 37.682],
    [126.995, 37.688], [126.982, 37.712], [126.985, 37.742], [126.998, 37.768], [127.032, 37.785]
];
const UIJEONGBU_POLY = turf.polygon([UIJEONGBU_BOUNDARY_POINTS]);
let roadNodes = new Map();
let nodeIndex = null;
const initRoadGraph = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (retries = 3) {
    if (roadNodes.size > 0)
        return;
    console.log('[GIS] Initializing Road Graph for Uijeongbu...');
    const bbox = [37.67, 126.98, 37.80, 127.13]; // minLat, minLng, maxLat, maxLng
    const query = `[out:json][timeout:60];(way["highway"~"primary|secondary|tertiary|residential|unclassified|service|pedestrian|path|footway"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}););out body;>;out skel qt;`;
    for (let i = 0; i < retries; i++) {
        try {
            const res = yield axios_1.default.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 45000
            });
            const elements = res.data.elements;
            // Pass 1: Collect Nodes
            elements.filter((e) => e.type === 'node').forEach((n) => {
                roadNodes.set(n.id.toString(), { id: n.id.toString(), lat: n.lat, lng: n.lon, adj: new Map() });
            });
            // Pass 2: Connect Ways
            elements.filter((e) => e.type === 'way').forEach((w) => {
                const nodes = w.nodes;
                for (let i = 0; i < nodes.length - 1; i++) {
                    const uId = nodes[i].toString();
                    const vId = nodes[i + 1].toString();
                    const u = roadNodes.get(uId);
                    const v = roadNodes.get(vId);
                    if (u && v) {
                        const dist = turf.distance(turf.point([u.lng, u.lat]), turf.point([v.lng, v.lat]), { units: 'meters' });
                        u.adj.set(vId, dist);
                        v.adj.set(uId, dist);
                    }
                }
            });
            const nodeList = Array.from(roadNodes.values());
            nodeIndex = new kdbush_1.default(nodeList.length);
            for (const n of nodeList) {
                nodeIndex.add(n.lng, n.lat);
            }
            nodeIndex.finish();
            console.log(`[GIS] Road Graph Loaded Successfully: ${roadNodes.size} nodes.`);
            return;
        }
        catch (err) {
            console.error(`[GIS] Attempt ${i + 1}/${retries} failed: ${err.message || 'Unknown error'}`);
            if (i < retries - 1) {
                const delay = Math.pow(2, i) * 2000;
                console.log(`[GIS] Retrying in ${delay}ms...`);
                yield new Promise(resolve => setTimeout(resolve, delay));
            }
            else {
                console.error('[GIS] Max retries reached. Falling back to basic circle calculation.');
            }
        }
    }
});
exports.initRoadGraph = initRoadGraph;
// 1. 도보 100m 등시선(Isochrone) 계산 (단순 8각 원형으로 원복 - 성능 최우선)
const create100mIsochrone = (lat, lng) => {
    return turf.circle(turf.point([lng, lat]), 0.1, { steps: 8, units: 'kilometers' });
};
exports.create100mIsochrone = create100mIsochrone;
// 메모리 캐시 저장소
let cachedRestrictedArea = null;
let cachedAvailableArea = null;
const clearAreaCache = () => {
    console.log('[GIS] Clearing area calculation cache...');
    cachedRestrictedArea = null;
    cachedAvailableArea = null;
};
exports.clearAreaCache = clearAreaCache;
// 2. 가용 영역(100m 초과 영역) 계산
const createAvailableArea = (points) => {
    if (cachedAvailableArea)
        return cachedAvailableArea;
    const validPoints = points.filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng));
    if (validPoints.length === 0)
        return turf.featureCollection([UIJEONGBU_POLY]);
    const buffers = validPoints.map(p => (0, exports.create100mIsochrone)(p.lat, p.lng));
    try {
        const bufferCollection = turf.featureCollection(buffers);
        const masked = turf.mask(bufferCollection, UIJEONGBU_POLY);
        if (!masked)
            return turf.featureCollection([UIJEONGBU_POLY]);
        cachedAvailableArea = turf.featureCollection([masked]);
        return cachedAvailableArea;
    }
    catch (e) {
        console.error('[GIS] Mask calculation failed:', e);
        return turf.featureCollection([UIJEONGBU_POLY]);
    }
};
exports.createAvailableArea = createAvailableArea;
// 3. 제한 영역(100m 이내 영역) 계산
const createRestrictedArea = (points) => {
    if (cachedRestrictedArea)
        return cachedRestrictedArea;
    const validPoints = points.filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng));
    if (validPoints.length === 0)
        return null;
    const buffers = validPoints.map(p => (0, exports.create100mIsochrone)(p.lat, p.lng));
    cachedRestrictedArea = turf.featureCollection(buffers);
    return cachedRestrictedArea;
};
exports.createRestrictedArea = createRestrictedArea;
// 4. 지도 Bounding Box 기반 데이터 필터링 유틸
const isPointInBounds = (lat, lng, bounds) => {
    return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
};
exports.isPointInBounds = isPointInBounds;
