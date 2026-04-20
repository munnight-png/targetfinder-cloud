import React, { useEffect, useState, useRef } from 'react';
import { X, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { 
  getStores, getTobaccoShops, getTargets, getRestrictedAreas,
  updateStoreCoords, updateTobaccoCoords 
} from '../api';

declare global { interface Window { naver: any; } }

const MapContainer = () => {
  const { 
    showStores, showTobacco, showTargets, showAreas, measureMode,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    setMapZoom, selectedEntity, setSelectedEntity, setContextMenu,
    stores, setStores, tobacco, setTobacco, targets, setTargets,
    searchResult,
    showCadastral,
    setShowMarketStatus,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    mapZoom, relocatingEntity, setRelocatingEntity,
    restrictedAreas, setRestrictedAreas
  } = useStore();
  
  const [panoVisible, setPanoVisible] = useState(false);
  const [panoCoord, setPanoCoord] = useState<{ lat: number, lng: number } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ type: string, data: any, oldPos: any, newPos: any, marker: any } | null>(null);
  
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<any>(null);
  const [isPanoReady, setIsPanoReady] = useState(false);
  const cadastralLayerRef = useRef<any>(null);
  const povMarkerRef = useRef<any>(null); 
  const streetLayerRef = useRef<any>(null);
  const dataLayerRef = useRef<any>(null); // GeoJSON 데이터 레이어 추가
  
  const storeMarkersRef = useRef<Map<number, any>>(new Map());
  const tobaccoMarkersRef = useRef<Map<number, any>>(new Map());
  const targetMarkersRef = useRef<Map<number, any>>(new Map());
  const searchMarkerRef = useRef<any>(null);
  const selectionMarkerRef = useRef<any>(null); // 선택 강조 마커 추가

  const measureModeRef = useRef(measureMode);
  useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);

  useEffect(() => { 
    if (!showAreas) return; // 끄더라도 데이터를 비우지 않고 유지하여 재사용
    
    // 이미 데이터가 있다면 다시 부르지 않음 (캐싱)
    if (restrictedAreas) return;
    
    getRestrictedAreas('on').then(data => setRestrictedAreas(data)); 
  }, [showAreas, setRestrictedAreas, restrictedAreas]);

  // 구역 데이터가 오면 맵에 그리기
  useEffect(() => {
    renderPolygons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restrictedAreas, showAreas]);

  const draggingRef = useRef<{ marker: any, type: string, data: any, initialFinger: any, initialMarker: any } | null>(null);
  const markerTimerRef = useRef<any>(null);
  const downTimeRef = useRef<number>(0);
  const movedAfterDownRef = useRef<boolean>(false);
  const overMovedRef = useRef<boolean>(false);
  const startOffsetRef = useRef<{ x: number, y: number } | null>(null);
  
  const measurementRef = useRef<{ polyline: any, markers: any[], labels: any[] }>({ polyline: null, markers: [], labels: [] });

  useEffect(() => {
    loadData(); initMap();
    const handleMoveMap = (e: any) => { if (mapRef.current) { const point = new window.naver.maps.LatLng(e.detail.lat, e.detail.lng); mapRef.current.setCenter(point); mapRef.current.setZoom(17); } };
    const handleOpenPano = (e: any) => { setPanoCoord(e.detail); setPanoVisible(true); };
    const handleTogglePano = () => { setPanoVisible(v => !v); };
    window.addEventListener('moveMap', handleMoveMap);
    window.addEventListener('openPano', handleOpenPano as any);
    window.addEventListener('togglePano', handleTogglePano);
    return () => { 
        window.removeEventListener('moveMap', handleMoveMap); 
        window.removeEventListener('openPano', handleOpenPano as any); 
        window.removeEventListener('togglePano', handleTogglePano);
    };
  }, []);

  const lastSentCoordRef = useRef<{lat: number, lng: number} | null>(null);

  // UNIFIED PANORAMA LIFECYCLE (Community Verified Strategy)
  useEffect(() => {
    if (!window.naver || !window.naver.maps || !window.naver.maps.Panorama) return;
    const container = document.getElementById('pano-ultimate-unified');
    if (!container) return;

    // 1. Initial Construction (Ensure DOM Frame is painted)
    if (!panoRef.current && panoVisible && panoCoord) {
        requestAnimationFrame(() => {
            if (!container || panoRef.current) return;
            console.log('[PANO] Unified Strategic Init:', panoCoord.lat, panoCoord.lng);
            const pos = new window.naver.maps.LatLng(panoCoord.lat, panoCoord.lng);
            
            try {
                // Clear container before init to prevent ghost contexts
                container.innerHTML = '';
                
                panoRef.current = new window.naver.maps.Panorama(container, {
                    position: pos,
                    visible: true,
                    aroundControl: true,
                    flightSpot: true
                });

                window.naver.maps.Event.addListener(panoRef.current, 'pano_status', (status: string) => {
                    if (status === 'OK') {
                        setIsPanoReady(true);
                        panoRef.current.setSize();
                    } else {
                        setIsPanoReady(false);
                    }
                });

                window.naver.maps.Event.addListener(panoRef.current, 'pano_changed', () => {
                    const p = panoRef.current.getPosition();
                    const newLat = p.lat();
                    const newLng = p.lng();
                    
                    // THRESHOLD GUARD: Breaks 1241-count loop
                    if (lastSentCoordRef.current) {
                        const d = Math.abs(lastSentCoordRef.current.lat - newLat) + 
                                  Math.abs(lastSentCoordRef.current.lng - newLng);
                        if (d < 0.0001) return; 
                    }
                    
                    setPanoCoord({ lat: newLat, lng: newLng });
                    if (povMarkerRef.current) povMarkerRef.current.setPosition(p);
                });

                window.naver.maps.Event.addListener(panoRef.current, 'pov_changed', () => {
                    const pan = panoRef.current.getPov().pan;
                    const el = document.getElementById('pano-pov-marker');
                    if (el) el.style.transform = `rotate(${pan + 170}deg)`;
                });

            } catch (e) {
                console.error('[PANO] Engine Construction Failure:', e);
            }
        });
    }

    // 2. Sync on Coordinate Change (>10m move only)
    if (panoRef.current && panoCoord && panoVisible) {
        const d = lastSentCoordRef.current ? 
                  Math.abs(lastSentCoordRef.current.lat - panoCoord.lat) + 
                  Math.abs(lastSentCoordRef.current.lng - panoCoord.lng) : 1;
        
        if (d > 0.0001) {
            const p = new window.naver.maps.LatLng(panoCoord.lat, panoCoord.lng);
            lastSentCoordRef.current = { lat: panoCoord.lat, lng: panoCoord.lng };
            panoRef.current.setPosition(p);
            panoRef.current.setVisible(true);
            setTimeout(() => panoRef.current?.setSize(), 200);
        }
    }
  }, [panoVisible, panoCoord]);

  const getCoordFromEvent = (ev: any, map: any) => {
    const native = ev.pointerEvent || (ev.originalEvent && ev.originalEvent.nativeEvent) || ev;
    const touches = native.touches || native.changedTouches;
    const pageX = (touches && touches.length > 0) ? touches[0].pageX : native.pageX;
    const pageY = (touches && touches.length > 0) ? touches[0].pageY : native.pageY;
    if (pageX === undefined || pageY === undefined) return null;
    const pt = new window.naver.maps.Point(pageX, pageY);
    return map.getProjection ? map.getProjection().fromOffsetToCoord(pt) : map.fromOffsetToCoord ? map.fromOffsetToCoord(pt) : null;
  };

  const getPosFromEvent = (ev: any) => {
    const native = ev.pointerEvent || (ev.originalEvent && ev.originalEvent.nativeEvent) || ev;
    const touches = native.touches || native.changedTouches;
    const clientX = (touches && touches.length > 0) ? touches[0].clientX : native.clientX;
    const clientY = (touches && touches.length > 0) ? touches[0].clientY : native.clientY;
    if (clientX === undefined || clientY === undefined || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };


  const initMap = () => {
    if (!containerRef.current || !window.naver || mapRef.current) return;
    const naver = window.naver;
    console.log('[SYSTEM] Initializing Naver Map for the first time...');
    const map = new naver.maps.Map(containerRef.current, { center: new naver.maps.LatLng(37.738, 127.033), zoom: 15, zoomControl: false, mapTypeControl: false });
    mapRef.current = map;
    containerRef.current.style.touchAction = 'none';
    
    naver.maps.Event.addListener(map, 'zoom_changed', () => setMapZoom(map.getZoom()));
    
    const initSubmodules = () => {
        if (!window.naver?.maps?.StreetLayer) {
            setTimeout(initSubmodules, 300);
            return;
        }
        if (!streetLayerRef.current) {
            streetLayerRef.current = new naver.maps.StreetLayer();
        }
    };
    initSubmodules();

    naver.maps.Event.addListener(map, 'click', (e: any) => {
        if (panoVisible && streetLayerRef.current?.getMap()) {
            window.dispatchEvent(new CustomEvent('openPano', { detail: { lat: e.coord.lat(), lng: e.coord.lng() } }));
        }
        
        // 정보창이 열려있으면 창만 닫고 우클릭 메뉴는 무시 (강력한 가드)
        if (useStore.getState().selectedEntity || useStore.getState().showMarketStatus) {
            setSelectedEntity(null);
            setShowMarketStatus(false);
            setContextMenu(null);
            return;
        }

        setContextMenu(null);
    });
    
    let mapTimer: any = null; 
    const onMapMove = (e: any) => {
        if (draggingRef.current) {
            const { initialFinger, initialMarker, marker } = draggingRef.current;
            const curFinger = getCoordFromEvent(e, map);
            if (curFinger && initialFinger) {
                const nextCoord = new window.naver.maps.LatLng(initialMarker.lat() + (curFinger.lat() - initialFinger.lat()), initialMarker.lng() + (curFinger.lng() - initialFinger.lng()));
                marker.setPosition(nextCoord);
            }
            movedAfterDownRef.current = true; if (e.pointerEvent && e.pointerEvent.cancelable) e.pointerEvent.preventDefault();
            return;
        }
        if (startOffsetRef.current && (Math.abs(e.offset.x - startOffsetRef.current.x) > 3 || Math.abs(e.offset.y - startOffsetRef.current.y) > 3)) {
            overMovedRef.current = true; 
            if (mapTimer) clearTimeout(mapTimer);
            // 지도를 움직이는 중이라면 마커 드래그 타이머 취소 (오드래그 방지 핵심: 3px 이상 움직이면 취소)
            if (markerTimerRef.current) {
                clearTimeout(markerTimerRef.current);
                markerTimerRef.current = null;
            }
        }
    };
    const onMapDown = (e: any) => {
        if (map.updateByMapSize) map.updateByMapSize();
        const native = e.pointerEvent || (e.originalEvent && e.originalEvent.nativeEvent) || e;
        if (native.touches && native.touches.length > 1) {
            if (markerTimerRef.current) clearTimeout(markerTimerRef.current);
            return;
        }
        if (measureModeRef.current) return; 
        const pos = getPosFromEvent(e); if (!pos) return;
        overMovedRef.current = false; 
        startOffsetRef.current = { x: e.offset.x, y: e.offset.y };
        
        if (mapTimer) clearTimeout(mapTimer);
        mapTimer = setTimeout(() => { 
            // 정보창이 열려있을 때는 길게 눌러도 ContextMenu 안 띄움
            if (useStore.getState().selectedEntity || useStore.getState().showMarketStatus) return;
            if (!overMovedRef.current && !draggingRef.current) setContextMenu({ visible: true, x: pos.x, y: pos.y, lat: e.coord.lat(), lng: e.coord.lng() }); 
        }, 800);
    };
    naver.maps.Event.addListener(map, 'mousedown', onMapDown);
    naver.maps.Event.addListener(map, 'touchstart', onMapDown);
    naver.maps.Event.addListener(map, 'mousemove', onMapMove);
    naver.maps.Event.addListener(map, 'touchmove', onMapMove);
  };

    const bindMarkerEvents = (marker: any, type: string, data: any) => {
    const naver = window.naver;
    naver.maps.Event.clearInstanceListeners(marker);

    const onDown = (e: any) => {
        const native = e.pointerEvent || (e.originalEvent && e.originalEvent.nativeEvent) || e;
        const initialFinger = native.touches ? { x: native.touches[0].clientX, y: native.touches[0].clientY } : { x: native.clientX, y: native.clientY };
        downTimeRef.current = Date.now(); 
        movedAfterDownRef.current = false;

        if (relocatingEntity && relocatingEntity.type === type && relocatingEntity.data.id === data.id) {
            startMarkerDrag(marker, type, data, initialFinger);
        }
    };

    const startMarkerDrag = (marker: any, type: string, data: any, initialFinger: {x: number, y: number}) => {
        if (mapRef.current.updateByMapSize) mapRef.current.updateByMapSize();
        draggingRef.current = { marker, type, data, initialFinger, initialMarker: marker.getPosition() };
        
        mapRef.current.setOptions({ 
            draggable: false, scrollWheel: false, pinchZoom: false,
            keyboardShortcuts: false, doubleClickZoom: false
        });
        
        if (window.navigator.vibrate) window.navigator.vibrate(50);
        
        const onGlobalMove = (ev: any) => {
            if (!draggingRef.current) return;
            const finger = ev.touches ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : { x: ev.clientX, y: ev.clientY };
            const deltaX = finger.x - draggingRef.current.initialFinger.x;
            const deltaY = finger.y - draggingRef.current.initialFinger.y;
            
            const proj = mapRef.current.getProjection();
            const startPoint = proj.fromCoordToOffset(draggingRef.current.initialMarker);
            const newPoint = new naver.maps.Point(startPoint.x + deltaX, startPoint.y + deltaY);
            const newCoord = proj.fromOffsetToCoord(newPoint);
            
            draggingRef.current.marker.setPosition(newCoord);
            if (selectionMarkerRef.current) selectionMarkerRef.current.setPosition(newCoord);
            
            if (ev.cancelable) ev.preventDefault();
        };

        const onGlobalEnd = async () => {
            window.removeEventListener('mousemove', onGlobalMove); window.removeEventListener('mouseup', onGlobalEnd);
            window.removeEventListener('touchmove', onGlobalMove); window.removeEventListener('touchend', onGlobalEnd);
            if (!draggingRef.current) return;
            const { type, data, marker, initialMarker } = draggingRef.current; 
            const pos = marker.getPosition();
            
            mapRef.current.setOptions({ 
                draggable: true, scrollWheel: true, pinchZoom: true,
                keyboardShortcuts: true, doubleClickZoom: true
            }); 
            draggingRef.current = null;
            setRelocatingEntity(null);
            setPendingMove({ type, data, oldPos: initialMarker, newPos: pos, marker });
        };

        window.addEventListener('mousemove', onGlobalMove, { passive: false });
        window.addEventListener('mouseup', onGlobalEnd);
        window.addEventListener('touchmove', onGlobalMove, { passive: false });
        window.addEventListener('touchend', onGlobalEnd);
    };

    const onUp = () => {
        if (measureModeRef.current) return;
        const duration = Date.now() - downTimeRef.current;
        if (duration < 300 && !movedAfterDownRef.current && !draggingRef.current) setSelectedEntity({ type: type as any, data });
    };
    naver.maps.Event.addListener(marker, 'mousedown', onDown);
    naver.maps.Event.addListener(marker, 'touchstart', onDown);
    naver.maps.Event.addListener(marker, 'mouseup', onUp);
    naver.maps.Event.addListener(marker, 'touchend', onUp);
  };

  useEffect(() => { 
    if (!mapRef.current) return; 
    renderAllMarkers(); 
    renderPolygons(); 
  }, [stores, tobacco, targets, restrictedAreas, showStores, showTobacco, showTargets, showAreas, searchResult, mapZoom, setMapZoom, relocatingEntity, setRelocatingEntity, setContextMenu, showCadastral, measureMode]);

  const renderAllMarkers = () => {
    const naver = window.naver; if (!naver || !mapRef.current) return;
    const map = mapRef.current; if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
    if (searchResult) {
       searchMarkerRef.current = new naver.maps.Marker({ position: new naver.maps.LatLng(searchResult.lat, searchResult.lng), map, zIndex: 1000, icon: { content: `<div class="notranslate" translate="no" style="position:relative; display:flex; flex-direction:column; align-items:center;"><div style="background-color:#3b82f6; color:white; padding:4px 10px; border-radius:20px; font-size:13px; font-weight:700; border:2px solid white; margin-bottom:5px;">검색 위치</div><div style="width:14px; height:14px; background-color:#3b82f6; border:2px solid white; border-radius:50%;"></div></div>`, anchor: new naver.maps.Point(40, 45) } });
    }
    const manageMarkers = (list: any[], ref: React.MutableRefObject<Map<number, any>>, type: string) => {
        const currentIds = new Set(list.map(i => i.id));
        
        ref.current.forEach((m, id) => {
            const item = list.find(i => i.id === id);
            const brandCode = item ? getBrandCode(item) : null;
            let shouldShow = false;
            if (item) {
                const isTargeted = item.is_target === 1;
                const isClosed = (item.name || '').includes('폐점');
                if (type === 'target') {
                    shouldShow = showTargets;
                } else if (!isClosed && (type === 'store' || brandCode)) {
                    shouldShow = showStores || (isTargeted && showTargets);
                } else {
                    shouldShow = showTobacco || (isTargeted && showTargets);
                }
            }
            if (!currentIds.has(id) || !shouldShow) { m.setMap(null); ref.current.delete(id); }
        });

        list.forEach(item => {
            if (!item.lat || !item.lng) return; 
            const brandCode = getBrandCode(item);
            const isTargeted = item.is_target === 1;
            const isClosed = (item.name || '').includes('폐점');
            let visible = false;
            if (type === 'target') {
                visible = showTargets;
            } else if (!isClosed && (type === 'store' || brandCode)) {
                visible = showStores || (isTargeted && showTargets);
            } else {
                visible = showTobacco || (isTargeted && showTargets);
            }

            if (!visible) return;

            const isPending = pendingMove && pendingMove.type === type && pendingMove.data.id === item.id;
            const currentPos = isPending ? pendingMove.newPos : new naver.maps.LatLng(item.lat, item.lng);

            let marker = ref.current.get(item.id); 
            const isTarget = item.is_target === 1 && showTargets; 
            const markerContent = getMarkerContent(type, item, isTarget);
            if (marker) {
                if (draggingRef.current?.marker !== marker) marker.setPosition(currentPos);
                marker.setIcon({ content: markerContent, anchor: isTarget ? new naver.maps.Point(21, 21) : new naver.maps.Point(14, 14) });
                marker.setClickable(!measureMode);
                bindMarkerEvents(marker, type, item);
            } else {
                marker = new naver.maps.Marker({ position: currentPos, map, zIndex: type === 'target' ? 200 : 100, clickable: !measureMode, icon: { content: markerContent, anchor: isTarget ? new naver.maps.Point(21, 21) : new naver.maps.Point(14, 14) } });
                bindMarkerEvents(marker, type, item); ref.current.set(item.id, marker);
            }
        });
    };
    manageMarkers(stores, storeMarkersRef, 'store'); manageMarkers(tobacco, tobaccoMarkersRef, 'tobacco'); manageMarkers(targets, targetMarkersRef, 'target');
  };

  const getBrandCode = (item: any) => {
    const n = item.name || '';
    
    // '폐점'이 포함된 경우 모든 브랜드 속성을 무시하고 담배소매인으로 간주 (최우선 가드)
    if (n.includes('폐점')) return null;
    
    if (item.brand_code) return item.brand_code;
    
    const isGS = n.includes('지에스') || n.includes('GS') || n.includes('gs') || n.includes('지에스25');
    const isCU = n.includes('CU') || n.includes('씨유');
    const isEM = n.includes('이마트') || n.includes('emart') || n.includes('Emart');
    const isSE = n.includes('세븐') || n.includes('seven');
    const isCS = n.includes('씨스페이스');

    if (!isGS && !isCU && !isEM && !isSE && !isCS) return null;

    // 브랜드 키워드가 있더라도 제외해야 할 업종 키워드 (부동산, 주유소 등)
    const excludeKeywords = ['공인중개사', '부동산', '주유소', '셀프', '정비', '카센타', '마트', '슈퍼'];
    if (excludeKeywords.some(k => n.includes(k))) {
        // 브랜드 명시적 키워드(25, 24, 편의점) 또는 이마트 자체가 포함된 경우 허용
        const isExplicit = n.includes('25') || n.includes('24') || n.includes('편의점');
        // '마트'는 이마트와 겹치므로 마트만 있고 24/편의점이 없는 경우만 제외
        if (!isExplicit && !isCU && !isGS && !isSE) return null;
    }

    if (isCU) return 'C';
    if (isGS) return 'G';
    if (isSE) return 'S';
    if (isEM) return 'E';
    if (isCS) return 'P';
    return null;
  };

  const getMarkerContent = (type: string, item: any, isTarget: boolean) => {
    if (isTarget || type === 'target') { return `<div class="relative flex items-center justify-center transform -translate-y-3 notranslate" translate="no" style="pointer-events:auto;"><svg width="42" height="42" viewBox="0 0 24 24" fill="#EC4899" stroke="white" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg><div class="absolute text-white font-black text-[11px] mt-0.5 drop-shadow-sm">${item.brand_code || ''}</div></div>`; }
    
    let brandCode = getBrandCode(item);
    
    // '폐점'이 포함된 경우 점포 종류와 무관하게 담배소매인 마커로 표시
    if ((item.name || '').includes('폐점')) {
        return `<div class="custom-marker cursor-move active:scale-110 transition-transform notranslate" translate="no" style="background-color:#4B5563; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; pointer-events:auto;">🚬</div>`;
    }

    // 담배소매인 리스트에 있더라도 브랜드가 확인되면 브랜드 마커로 표시
    if (type === 'store' || brandCode) {
        const b = brandCode || '?';
        const is2026 = parseInt(item.expiration_date?.split('-')[0] || '0') === 2026;
        let color = '#10B981'; 
        if (is2026) color = '#EF4444'; 

        return `<div class="custom-marker cursor-move active:scale-110 transition-transform notranslate" translate="no" style="background-color:${color}; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; border:2px solid white; pointer-events:auto;">${b}</div>`;
    }
    if (type === 'tobacco') { return `<div class="custom-marker cursor-move active:scale-110 transition-transform notranslate" translate="no" style="background-color:#4B5563; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; pointer-events:auto;">🚬</div>`; }
    return '';
  };

  const renderPolygons = () => {
    const naver = window.naver; 
    if (!naver || !mapRef.current) return; 
    
    // 1. 기존 데이터 레이어 전면 제거 (상태 꼬임 방지)
    if (dataLayerRef.current) {
        dataLayerRef.current.setMap(null);
        dataLayerRef.current = null;
    }

    // 2. 오프 모드거나 데이터가 없으면 여기서 종료
    if (!showAreas || !restrictedAreas) return;

    // 3. 새 데이터 레이어 생성 및 스타일 설정
    dataLayerRef.current = new naver.maps.Data();
    dataLayerRef.current.setStyle(() => ({
        fillColor: '#10B981', 
        fillOpacity: 0.15, // 투명도를 대폭 높임 (0.45 -> 0.15)
        strokeColor: '#059669', 
        strokeOpacity: 0.3,
        strokeWeight: 1.5,
        clickable: false
    }));

    // 4. GeoJSON 데이터 추가 및 맵에 표시
    dataLayerRef.current.addGeoJson(restrictedAreas);
    dataLayerRef.current.setMap(mapRef.current);
  };

  const addMeasurePoint = (latlng: any) => {
    if (!measurementRef.current.polyline) { measurementRef.current.polyline = new window.naver.maps.Polyline({ map: mapRef.current, path: [latlng], strokeColor: '#3b82f6', strokeWeight: 4 }); }
    else { measurementRef.current.polyline.getPath().push(latlng); }
    measurementRef.current.markers.push(new window.naver.maps.Marker({ position: latlng, map: mapRef.current, icon: { content: `<div style="width:10px; height:10px; background:#3b82f6; border:2px solid white; border-radius:50%;"></div>`, anchor: new window.naver.maps.Point(5, 5) } }));
    const path = measurementRef.current.polyline.getPath();
    if (path.length > 1) {
        let totalD = 0; for (let i=0; i<path.length-1; i++) { totalD += mapRef.current.getProjection().getDistance(path.getAt(i), path.getAt(i+1)); }
        measurementRef.current.labels.push(new window.naver.maps.Marker({ position: latlng, map: mapRef.current, icon: { content: `<div style="background:#3b82f6; color:white; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:bold; white-space:nowrap; border:2px solid white; transform:translateY(-20px);">${Math.round(totalD)}m</div>`, anchor: new window.naver.maps.Point(0, 0) } }));
    }
  };
  const clearMeasurement = () => { if (measurementRef.current.polyline) measurementRef.current.polyline.setMap(null); measurementRef.current.markers.forEach(m => m.setMap(null)); measurementRef.current.labels.forEach(l => l.setMap(null)); measurementRef.current = { polyline: null, markers: [], labels: [] }; };

  useEffect(() => {
    if (!mapRef.current || !window.naver) return;
    if (measureMode) {
      mapRef.current.setCursor('crosshair'); const clickListener = window.naver.maps.Event.addListener(mapRef.current, 'click', (e: any) => addMeasurePoint(e.coord));
      return () => { window.naver.maps.Event.removeListener(clickListener); clearMeasurement(); mapRef.current?.setCursor(''); };
    } else { clearMeasurement(); mapRef.current?.setCursor(''); }
  }, [measureMode]);

  useEffect(() => { 
    if (mapRef.current) window.naver.maps.Event.trigger(mapRef.current, 'resize');
  }, [panoVisible]);

  useEffect(() => { 
    if (!mapRef.current) return;
    if (streetLayerRef.current) {
        streetLayerRef.current.setMap(panoVisible ? mapRef.current : null);
    }
  }, [panoVisible]);

  useEffect(() => { if (!mapRef.current) return; if (showCadastral) { if (!cadastralLayerRef.current) cadastralLayerRef.current = new window.naver.maps.CadastralLayer(); cadastralLayerRef.current.setMap(mapRef.current); } else if (cadastralLayerRef.current) cadastralLayerRef.current.setMap(null); }, [showCadastral]);

  const loadData = async () => {
    const [s, t, tg] = await Promise.all([getStores(), getTobaccoShops(), getTargets()]);
    setStores(s); setTobacco(t); setTargets(tg); 
    if (showAreas) {
        const a = await getRestrictedAreas('on');
        setRestrictedAreas(a);
    }
  };

  const handleConfirmMove = async () => {
    if (!pendingMove) return;
    const { type, data, newPos } = pendingMove;
    if (type === 'store') await updateStoreCoords(data.id, newPos.lat(), newPos.lng());
    else if (type === 'tobacco') await updateTobaccoCoords(data.id, newPos.lat(), newPos.lng());
    setPendingMove(null);
    loadData();
  };

  const handleCancelMove = () => {
    if (!pendingMove) return;
    pendingMove.marker.setPosition(pendingMove.oldPos);
    setPendingMove(null);
  };

  // 엔티티 선택 시 지도 중심 이동 (오프셋 반영) 및 강조 마커 표시
  useEffect(() => {
    if (!mapRef.current) return;
    
    // 기존 강조 마커 제거
    if (selectionMarkerRef.current) {
        selectionMarkerRef.current.setMap(null);
        selectionMarkerRef.current = null;
    }

    const target = selectedEntity || relocatingEntity;
    if (target) {
        const { lat, lng } = target.data;
        const center = new window.naver.maps.LatLng(lat, lng);
        
        // 새로운 강조 마커 (파란색 도넛 모양)
        selectionMarkerRef.current = new window.naver.maps.Marker({
            position: center,
            map: mapRef.current,
            zIndex: 500,
            icon: {
                content: `<div class="selection-highlight" style="width:100px; height:100px; border:4px solid #3b82f6; border-radius:50%; background:rgba(59, 130, 246, 0.15); transform:translate(-50%, -50%); animation: pulse-selection 1.5s infinite;"></div>`,
                anchor: new window.naver.maps.Point(0, 0)
            }
        });

        if (selectedEntity) { // 이동 모드가 아닌 일반 선택 시에만 중심 이동
            const proj = mapRef.current.getProjection();
            const offsetPoint = proj.fromCoordToOffset(center);
            offsetPoint.y += window.innerHeight * 0.15;
            const newCenter = proj.fromOffsetToCoord(offsetPoint);
            mapRef.current.panTo(newCenter);
        }
    }
  }, [selectedEntity, relocatingEntity]);

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden relative">
      {/* Panorama Panel (Permanently Mounted to prevent Iframe reset) */}
      <div 
        key="global-panorama-shell"
        className="w-full border-b border-gray-300 shadow-2xl relative bg-black transition-all duration-500 ease-in-out"
        style={{ 
            height: '240px',
            marginTop: panoVisible ? '0' : '-240px',
            transform: panoVisible ? 'translateY(0)' : 'translateY(-100%)',
            opacity: panoVisible ? 1 : 0,
            zIndex: 9999, // Ultimate UI Priority
            pointerEvents: panoVisible ? 'auto' : 'none',
            visibility: panoVisible ? 'visible' : 'hidden'
        }}
      >
          {/* Unified Panorama Engine */}
          <div className="w-full h-full relative" style={{ backgroundColor: '#001122' }}>
            <div 
                id="pano-ultimate-unified"
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
            />
            {(!isPanoReady && panoVisible) && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#001122]/50 z-[10001]">
                    <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
            )}
            <button 
                onClick={() => setPanoVisible(false)} 
                className="absolute top-4 right-4 bg-black/80 hover:bg-black p-3 rounded-full backdrop-blur-xl border border-white/40 shadow-2xl z-[10002]"
            >
                <X className="text-white" size={28} />
            </button>
          </div>
      </div>

      {/* Relocation Overlay (Guide) */}
      <AnimatePresence>
        {relocatingEntity && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-[9500] w-[90%] max-w-sm"
          >
            <div className="bg-blue-600/95 backdrop-blur-xl text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-blue-400/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                   <MapPin size={18} />
                </div>
                <div>
                   <p className="font-bold text-sm">마커를 잡아서 원하는 위치로 옮기세요</p>
                   <p className="text-[10px] opacity-80">해당 마커를 터치 후 드래그하면 이동합니다</p>
                </div>
              </div>
              <button 
                onClick={() => setRelocatingEntity(null)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-black transition-colors"
              >취소</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      <div ref={containerRef} onContextMenu={(e) => e.preventDefault()} className="flex-1 w-full relative z-10 overflow-hidden" style={{ touchAction: 'pan-x pan-y' }} />

      {/* Marker Move Confirmation UI (Hidden during select mode) */}
      {pendingMove && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-3 w-[90%] max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="bg-white/95 backdrop-blur-md border border-white/20 shadow-2xl rounded-3xl p-5 w-full flex flex-col gap-4">
                <div className="flex items-center gap-3 text-gray-800 font-bold justify-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping" />
                    마커 위치를 변경하시겠습니까?
                </div>
                <div className="flex gap-3 w-full">
                    <button 
                        onClick={handleCancelMove}
                        className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-colors active:scale-95"
                    >
                        취소
                    </button>
                    <button 
                        onClick={handleConfirmMove}
                        className="flex-[2] py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-95"
                    >
                        이동 완료
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;
