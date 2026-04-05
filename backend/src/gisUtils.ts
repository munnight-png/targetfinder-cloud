import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, FeatureCollection, LineString } from 'geojson';
import axios from 'axios';
import KDBush from 'kdbush';
import geokdbush from 'geokdbush';

// 의정부시 경계 폴리곤 (WGS84) - 단순화된 15개 지점
const UIJEONGBU_BOUNDARY_POINTS: [number, number][] = [
  [127.032, 37.785], [127.050, 37.795], [127.075, 37.788], [127.100, 37.772], [127.122, 37.755],
  [127.128, 37.728], [127.115, 37.705], [127.085, 37.692], [127.055, 37.680], [127.025, 37.682],
  [126.995, 37.688], [126.982, 37.712], [126.985, 37.742], [126.998, 37.768], [127.032, 37.785]
];
const UIJEONGBU_POLY = turf.polygon([UIJEONGBU_BOUNDARY_POINTS]);

// --- Road Graph Infra ---
interface RoadNode { id: string; lat: number; lng: number; adj: Map<string, number>; }
let roadNodes: Map<string, RoadNode> = new Map();
let nodeIndex: any = null;

export const initRoadGraph = async (retries = 3) => {
  if (roadNodes.size > 0) return;
  console.log('[GIS] Initializing Road Graph for Uijeongbu...');
  const bbox = [37.67, 126.98, 37.80, 127.13]; // minLat, minLng, maxLat, maxLng
  const query = `[out:json][timeout:60];(way["highway"~"primary|secondary|tertiary|residential|unclassified|service|pedestrian|path|footway"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}););out body;>;out skel qt;`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 45000 
      });
      const elements = res.data.elements;
      
      // Pass 1: Collect Nodes
      elements.filter((e: any) => e.type === 'node').forEach((n: any) => {
        roadNodes.set(n.id.toString(), { id: n.id.toString(), lat: n.lat, lng: n.lon, adj: new Map() });
      });
      
      // Pass 2: Connect Ways
      elements.filter((e: any) => e.type === 'way').forEach((w: any) => {
        const nodes = w.nodes;
        for (let i = 0; i < nodes.length - 1; i++) {
          const uId = nodes[i].toString();
          const vId = nodes[i+1].toString();
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
      nodeIndex = new KDBush(nodeList.length);
      for (const n of nodeList) { nodeIndex.add(n.lng, n.lat); }
      nodeIndex.finish();
      
      console.log(`[GIS] Road Graph Loaded Successfully: ${roadNodes.size} nodes.`);
      return; 
    } catch (err: any) {
      console.error(`[GIS] Attempt ${i+1}/${retries} failed: ${err.message || 'Unknown error'}`);
      if (i < retries - 1) {
          const delay = Math.pow(2, i) * 2000;
          console.log(`[GIS] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
      } else {
          console.error('[GIS] Max retries reached. Falling back to basic circle calculation.');
      }
    }
  }
};

// 1. 도보 100m 등시선(Isochrone) 계산 (단순 8각 원형으로 원복 - 성능 최우선)
export const create100mIsochrone = (lat: number, lng: number): Feature<Polygon> => {
  return turf.circle(turf.point([lng, lat]), 0.1, { steps: 8, units: 'kilometers' }) as Feature<Polygon>;
};

// 메모리 캐시 저장소
let cachedRestrictedArea: any = null;
let cachedAvailableArea: any = null;

export const clearAreaCache = () => {
  console.log('[GIS] Clearing area calculation cache...');
  cachedRestrictedArea = null;
  cachedAvailableArea = null;
};

// 2. 가용 영역(100m 초과 영역) 계산
export const createAvailableArea = (points: { lat: number, lng: number }[]): FeatureCollection<Polygon | MultiPolygon> | null => {
  if (cachedAvailableArea) return cachedAvailableArea;

  const validPoints = points.filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng));
  if (validPoints.length === 0) return turf.featureCollection([UIJEONGBU_POLY]);
  
  const buffers = validPoints.map(p => create100mIsochrone(p.lat, p.lng));
  
  try {
    const bufferCollection = turf.featureCollection(buffers);
    const masked = turf.mask(bufferCollection as any, UIJEONGBU_POLY);
    if (!masked) return turf.featureCollection([UIJEONGBU_POLY]);
    cachedAvailableArea = turf.featureCollection([masked]) as FeatureCollection<Polygon | MultiPolygon>;
    return cachedAvailableArea;
  } catch (e) {
    console.error('[GIS] Mask calculation failed:', e);
    return turf.featureCollection([UIJEONGBU_POLY]);
  }
};

// 3. 제한 영역(100m 이내 영역) 계산
export const createRestrictedArea = (points: { lat: number, lng: number }[]): FeatureCollection<Polygon | MultiPolygon> | null => {
  if (cachedRestrictedArea) return cachedRestrictedArea;

  const validPoints = points.filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng));
  if (validPoints.length === 0) return null;
  
  const buffers = validPoints.map(p => create100mIsochrone(p.lat, p.lng));
  cachedRestrictedArea = turf.featureCollection(buffers);
  return cachedRestrictedArea;
};

// 4. 지도 Bounding Box 기반 데이터 필터링 유틸
export const isPointInBounds = (lat: number, lng: number, bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number }) => {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
};
