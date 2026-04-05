import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { X, Building2, Calendar, MapPin, Search, Trash2, Edit2, Check, RotateCcw, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getMemos, saveMemo, getStats, saveTarget, getTargets, deleteTarget, 
  resetEntityCoords, getStores, getTobaccoShops, getRestrictedAreas, 
  toggleEntityTarget, updateEntityName, updateMemo, deleteMemo,
  getBuildingLedger
} from '../api';

declare global {
  interface Window {
    naver: any;
  }
}
const naver = (window as any).naver;

const BottomSheet = () => {
  const { 
    selectedEntity, setSelectedEntity, showMarketStatus, setShowMarketStatus,
    stores, tobacco, setTargets, setStores, setTobacco, setRelocatingEntity,
    setRestrictedAreas, showAreas
  } = useStore();
  const [memos, setMemos] = useState<any[]>([]);
  const [memoInput, setMemoInput] = useState('');
  const [stats, setStats] = useState<any[]>([]);
  const [locationInfo, setLocationInfo] = useState<{ address: string, lat: number, lng: number, nearestTobacco?: any, nearestStore?: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
  const [editMemoInput, setEditMemoInput] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | 'none' }>({ key: 'count', direction: 'desc' });
  const [loadingBuilding, setLoadingBuilding] = useState(false);
  const [buildingInfo, setBuildingInfo] = useState<any>(null);

  useEffect(() => {
    if (selectedEntity) {
      setBuildingInfo(null); // 엔티티 변경 시 초기화
      fetchLocationInfo();
      if (selectedEntity.type !== 'location') {
        loadMemos();
      }
    } else if (showMarketStatus) {
      loadStats();
    }
  }, [selectedEntity, showMarketStatus]);

  const fetchLocationInfo = async () => {
    if (!selectedEntity || !window.naver) return;
    const { lat, lng, autoSave } = selectedEntity.data;
    if (locationInfo && locationInfo.lat === lat && locationInfo.lng === lng) {
        setLoading(false);
        return;
    }
    setLoading(true);

    const fetchLedger = async (lt: number, lg: number, codeInfo?: any) => {
        setLoadingBuilding(true);
        try {
            const res = await getBuildingLedger(lt, lg, codeInfo);
            if (res.success) setBuildingInfo(res.building);
            else setBuildingInfo({ error: res.message || '정보 없음' });
        } catch (e) {
            setBuildingInfo({ error: '데이터 통신 오류' });
        } finally {
            setLoadingBuilding(false);
        }
    };

    // 1. 네이버 Reverse Geocode를 통해 주소 및 법정동 코드 확보 (백엔드 401 우회용)
    try {
        naver.maps.Service.reverseGeocode({
            coords: new naver.maps.LatLng(lat, lng),
            orders: [
                naver.maps.Service.OrderType.ADDR, 
                naver.maps.Service.OrderType.ROAD_ADDR,
                'legalcode'
            ].join(',')
        }, async (status: any, response: any) => {
            let address = selectedEntity.data.address || '주소를 찾을 수 없습니다.';
            let extractedCodes: any = null;

            if (status === naver.maps.Service.Status.OK && response.v2) {
                const addr = response.v2.address;
                // 명시적으로 주소를 찾지 못한 경우에만 역지오코딩 결과 주소 사용
                if (!selectedEntity.data.address) {
                    address = addr.roadAddress || addr.jibunAddress;
                }
                
                const legalResult = response.v2.results?.find((r: any) => r.name === 'legalcode' || r.name === 'addr');
                if (legalResult) {
                    const fullCode = legalResult.code?.id;
                    if (fullCode) {
                        extractedCodes = {
                            sigunguCd: fullCode.substring(0, 5),
                            bjdongCd: fullCode.substring(5, 10)
                        };
                        if (legalResult.land) {
                            extractedCodes.bun = legalResult.land.number1?.padStart(4, '0');
                            extractedCodes.ji = legalResult.land.number2?.padStart(4, '0') || '0000';
                        }
                    }
                }
                
                if (!address && response.v2.results && response.v2.results.length > 0) {
                    const r = response.v2.results[0];
                    const region = r.region;
                    address = [region.area1.name, region.area2.name, region.area3.name, region.area4.name].filter(v => !!v.name).map(v => v.name).join(' ');
                }
            }
            // 거리 계산 및 저장
            calculateDistances(lat, lng, address, selectedEntity.type === 'location' ? autoSave : false);
            // 건축물대장 조회 (확보된 코드 포함)
            fetchLedger(lat, lng, extractedCodes);
        });
    } catch (err) {
        console.error('Reverse Geocode Error:', err);
        calculateDistances(lat, lng, selectedEntity.data.address || '주소 조회 오류', false);
        fetchLedger(lat, lng);
    }
  };

  const calculateDistances = (lat: number, lng: number, address: string, autoSave?: boolean) => {
    const dist = (l1: any, l2: any) => {
        const dy = l1.lat - l2.lat;
        const dx = l1.lng - l2.lng;
        return Math.sqrt(dx*dx + dy*dy) * 111000;
    };
    let minT = { data: null, d: Infinity };
    tobacco.forEach(t => {
        if (selectedEntity?.type === 'tobacco' && selectedEntity.data.id === t.id) return;
        const d = dist({lat, lng}, t);
        if (d < minT.d) minT = { data: t, d };
    });
    let minS = { data: null, d: Infinity };
    stores.forEach(s => {
        if (selectedEntity?.type === 'store' && selectedEntity.data.id === s.id) return;
        const d = dist({lat, lng}, s);
        if (d < minS.d) minS = { data: s, d };
    });
    setLocationInfo({
        address, lat, lng,
        nearestTobacco: (minT.data ? { ...(minT.data as any), distance: Math.round(minT.d) } : null),
        nearestStore: (minS.data ? { ...(minS.data as any), distance: Math.round(minS.d) } : null)
    });
    setLoading(false);
    if (autoSave) handleSaveAsTarget(address, lat, lng);
  };

  const handleSaveAsTarget = async (addr?: string, lt?: number, lg?: number) => {
    const address = addr || locationInfo?.address || '미지정 주소';
    const lat = lt || selectedEntity?.data.lat;
    const lng = lg || selectedEntity?.data.lng;
    let name = address.split(' ').slice(-2).join(' ');
    if (address === '주소를 찾을 수 없습니다.' || address === '주소 정보 미흡' || !name) name = '신규 타겟 후보지';
    const newTarget = { name, address, area_size: 0, rent_fee: 0, memo: '', lat, lng };
    const res = await saveTarget(newTarget);
    if (res.success) {
      setTargets(await getTargets());
      setSelectedEntity({ type: 'target', data: { ...newTarget, id: res.id } });
    }
  };

  const handleDeleteTarget = async () => {
    if (!selectedEntity || selectedEntity.type !== 'target' || !window.confirm('삭제하시겠습니까?')) return;
    const res = await deleteTarget(selectedEntity.data.id);
    if (res.success) {
      setTargets(await getTargets()); setSelectedEntity(null);
    }
  };

  const loadMemos = async () => {
    if (!selectedEntity) return;
    setMemos(await getMemos(selectedEntity.type, selectedEntity.data.id));
  };

  const loadStats = async () => { setStats(await getStats()); };

  const sortedStats = (stats: any[]) => {
      if (sortConfig.direction === 'none') return stats;
      return [...stats].sort((a, b) => {
          let valA = a[sortConfig.key];
          let valB = b[sortConfig.key];
          if (sortConfig.key === 'ms') {
              valA = parseFloat(valA);
              valB = parseFloat(valB);
          }
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  const handleSort = (key: string) => {
      setSortConfig(prev => {
          if (prev.key !== key) return { key, direction: 'desc' };
          if (prev.direction === 'desc') return { key, direction: 'asc' };
          if (prev.direction === 'asc') return { key, direction: 'none' };
          return { key, direction: 'desc' };
      });
  };

  const getSortIcon = (key: string) => {
      if (sortConfig.key !== key || sortConfig.direction === 'none') return '⇅';
      return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const handleSaveMemo = async () => {
    if (!memoInput.trim() || !selectedEntity) return;
    await saveMemo(selectedEntity.type, selectedEntity.data.id, memoInput);
    setMemoInput(''); loadMemos();
  };

  const handleUpdateName = async () => {
    if (!nameInput.trim() || !selectedEntity) return;
    const res = await updateEntityName(selectedEntity.type, selectedEntity.data.id, nameInput);
    if (res.data.success) {
        setSelectedEntity({ ...selectedEntity, data: { ...selectedEntity.data, name: nameInput } });
        if (selectedEntity.type === 'store') {
            setStores(await getStores());
            if (showAreas) {
                const areas = await getRestrictedAreas('on');
                setRestrictedAreas(areas);
            }
            loadStats();
        }
        else if (selectedEntity.type === 'tobacco') {
            setTobacco(await getTobaccoShops());
            if (showAreas) {
                const areas = await getRestrictedAreas('on');
                setRestrictedAreas(areas);
            }
            loadStats();
        }
        setEditingName(false);
    }
  };

  const handleUpdateMemo = async (id: number) => {
    if (!editMemoInput.trim()) return;
    await updateMemo(id, editMemoInput);
    setEditingMemoId(null); loadMemos();
  };

  const handleDeleteMemo = async (id: number) => {
    if (!window.confirm('메모를 삭제하시겠습니까?')) return;
    await deleteMemo(id);
    loadMemos();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        alert('주소가 복사되었습니다.');
    });
  };

  const [sheetY, setSheetY] = useState(window.innerHeight * 0.5); 
  
  useEffect(() => {
    if (selectedEntity || showMarketStatus) {
        setSheetY(window.innerHeight * 0.5);
    }
  }, [selectedEntity, showMarketStatus]);

  return (
    <AnimatePresence>
      {(selectedEntity || showMarketStatus) && (
        <motion.div
           key="bottom-sheet" 
           initial={{ height: 0 }} 
           animate={{ height: window.innerHeight - sheetY }} 
           exit={{ height: 0 }}
           // drag="y" 제거: 직접 sheetY를 관리하여 애니메이션과 충돌 방지
           transition={{ type: 'spring', damping: 25, stiffness: 200 }}
           className="fixed bottom-0 left-0 w-full bg-white rounded-t-[32px] shadow-[0_-12px_50px_rgba(0,0,0,0.25)] z-50 flex flex-col overflow-hidden"
        >
          {/* Drag Handle Area */}
          <div 
            className="w-full h-12 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing shrink-0 select-none touch-none bg-white z-[60]"
            onPointerDown={(e) => {
                const startY = e.pageY;
                const startSheetY = sheetY;
                const onPointerMove = (moveEv: PointerEvent) => {
                    const deltaY = moveEv.pageY - startY;
                    let nextY = startSheetY + deltaY;
                    if (nextY < 80) nextY = 80;
                    if (nextY > window.innerHeight - 60) nextY = window.innerHeight - 60;
                    setSheetY(nextY);
                };
                const onPointerUp = () => {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                };
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
            }}
          >
            <div className="w-14 h-1.5 bg-gray-300 rounded-full"></div>
            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">Swipe to Resize</p>
          </div>
          
          <div className="relative p-6 pt-0 pb-20 overflow-y-auto flex-1 pointer-events-auto scrollbar-hide">
            {(!selectedEntity || !loading) && (
              <button 
                onClick={() => { setSelectedEntity(null); setShowMarketStatus(false); }}
                className="absolute top-[-8px] right-6 p-2.5 bg-red-50 rounded-full text-red-500 hover:bg-red-100 z-[60] transition-all active:scale-90 shadow-sm"
              ><X size={22} /></button>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">조회 중...</p>
              </div>
            ) : !selectedEntity ? (
              <div className="flex flex-col h-full">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2"><Building2 className="text-blue-500"/> 편의점 시장 현황</h2>
                
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_60px_60px_70px] gap-2 px-4 py-2 bg-gray-100 rounded-t-xl text-[11px] font-black text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="cursor-pointer flex items-center gap-1" onClick={() => handleSort('brand')}>브랜드 <span className="text-[10px] opacity-50">{getSortIcon('brand')}</span></div>
                    <div className="cursor-pointer flex items-center gap-1 justify-end" onClick={() => handleSort('count')}>점포수 <span className="text-[10px] opacity-50">{getSortIcon('count')}</span></div>
                    <div className="cursor-pointer flex items-center gap-1 justify-end" onClick={() => handleSort('ms')}>M/S <span className="text-[10px] opacity-50">{getSortIcon('ms')}</span></div>
                    <div className="cursor-pointer flex items-center gap-1 justify-end" onClick={() => handleSort('expireCount')}>만료점 <span className="text-[10px] opacity-50">{getSortIcon('expireCount')}</span></div>
                </div>

                <div className="border-x border-b border-gray-100 rounded-b-xl overflow-hidden bg-white max-h-[360px] overflow-y-auto scrollbar-hide">
                  <div className="divide-y divide-gray-100">
                    {sortedStats(stats).map((s, idx) => {
                      const isTarget = s.brand === '타겟';
                      const brandMap: Record<string, string> = { 'C': 'CU', 'G': 'GS25', 'E': 'emart24', 'S': '세븐일레븐', 'P': '씨스페이스' };
                      const reverseMap: Record<string, string> = { 'CU': 'C', 'GS25': 'G', 'emart24': 'E', '세븐일레븐': 'S', '씨스페이스': 'P' };
                      const brandFullName = brandMap[s.brand] || s.brand;
                      const markerLetter = reverseMap[brandFullName] || brandFullName.substring(0,1);
                      
                      return (
                        <div key={s.brand} className={`grid grid-cols-[1fr_60px_60px_70px] gap-2 items-center px-4 py-3.5 ${isTarget ? 'bg-pink-50/50' : idx % 2 === 1 ? 'bg-gray-50/30' : 'bg-white'}`}>
                          <div className="flex items-center gap-2.5">
                            <span className={`w-7 h-7 flex items-center justify-center rounded-full text-white font-black text-[11px] shadow-sm border border-white/50 ${isTarget ? 'bg-[#EC4899]' : 'bg-[#10B981]'}`}>
                              {isTarget ? '⭐' : markerLetter}
                            </span>
                            <span className={`text-sm font-bold ${isTarget ? 'text-pink-600' : 'text-gray-700'}`}>{brandFullName}</span>
                          </div>
                          <div className="text-right text-sm font-black text-gray-900">{s.count}<span className="text-[10px] font-medium text-gray-400 ml-0.5">개</span></div>
                          <div className="text-right text-sm font-bold text-blue-600">{s.ms}<span className="text-[10px] font-medium opacity-60 ml-0.5">%</span></div>
                          <div className="text-right">
                             {s.expireCount > 0 ? (
                                 <span className="text-xs font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">{s.expireCount}</span>
                             ) : <span className="text-xs text-gray-300">-</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <p className="mt-4 text-[10px] text-gray-400 text-center font-medium">* 만료점 카운트는 2027년까지 만료 예정인 브랜드 점포입니다.</p>
              </div>
            ) : (
              <div>
                <div 
                   className="w-full h-32 bg-gray-200 rounded-xl mb-4 overflow-hidden relative cursor-pointer active:opacity-90 hover:ring-2 hover:ring-blue-500 transition-all group"
                   onClick={() => {
                     setSelectedEntity(null);
                     window.dispatchEvent(new CustomEvent('openPano', { detail: { lat: selectedEntity.data.lat, lng: selectedEntity.data.lng } }));
                   }}
                >
                  <img 
                    src={`http://${window.location.hostname}:3001/api/pano-proxy?lat=${selectedEntity.data.lat}&lng=${selectedEntity.data.lng}`} 
                    alt="Street View" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                    onError={(e) => e.currentTarget.style.display = 'none'} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                     <span className="text-white font-black drop-shadow-md flex items-center gap-2"><Search size={16} className="text-blue-400"/> 로드뷰 (거리뷰)로 보기</span>
                  </div>
                </div>

                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="flex-1">
                    {editingName ? (
                        <div className="flex gap-2 items-center">
                            <input 
                                value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                                className="flex-1 text-xl font-bold border-b-2 border-blue-500 outline-none pb-1 bg-blue-50/30 px-1"
                                autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                            />
                            <button onClick={handleUpdateName} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Check size={18}/></button>
                            <button onClick={() => setEditingName(false)} className="p-2 text-gray-400 bg-gray-50 rounded-lg"><RotateCcw size={18}/></button>
                        </div>
                    ) : (
                        <h2 
                            className="text-2xl font-black text-gray-900 leading-tight tracking-tight cursor-pointer hover:bg-gray-50 active:bg-gray-100 rounded-lg px-1 -ml-1 transition-all flex items-center gap-2 group"
                            onClick={() => { setEditingName(true); setNameInput(selectedEntity.data.name || ''); }}
                        >
                          {selectedEntity.type === 'location' ? '선택한 위치' : selectedEntity.data.name}
                          {selectedEntity.type !== 'location' && <Edit2 size={16} className="text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />}
                        </h2>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-gray-500 flex items-center gap-1.5 font-medium leading-normal text-sm sm:text-base">
                            <MapPin size={16} className="text-blue-500 shrink-0"/> {locationInfo?.address || selectedEntity.data.address || '주소 정보 없음'}
                        </p>
                        <button 
                            onClick={() => copyToClipboard(locationInfo?.address || selectedEntity.data.address || '')}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg transition-all active:scale-90 shrink-0"
                        >
                            <Copy size={16}/>
                        </button>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-2">
                    {(selectedEntity.type === 'store' || selectedEntity.type === 'tobacco') && (
                      <button
                        onClick={async () => {
                          const ns = !selectedEntity.data.is_target;
                          setSelectedEntity({ ...selectedEntity, data: { ...selectedEntity.data, is_target: ns } });
                          if (selectedEntity.type === 'store') setStores(stores.map(s => s.id === selectedEntity.data.id ? { ...s, is_target: ns ? 1 : 0 } : s));
                          else setTobacco(tobacco.map(t => t.id === selectedEntity.data.id ? { ...t, is_target: ns ? 1 : 0 } : t));
                          toggleEntityTarget(selectedEntity.type, selectedEntity.data.id, ns);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 font-bold text-sm h-[44px] ${selectedEntity.data.is_target ? 'bg-pink-50 border-pink-500 text-pink-600' : 'bg-white border-gray-200 text-gray-500'}`}
                      >⭐ {selectedEntity.data.is_target ? '타겟' : '추가'}</button>
                    )}
                    {selectedEntity.type === 'location' && (
                        <button onClick={() => handleSaveAsTarget()} className="bg-pink-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg h-[44px]">저장</button>
                    )}
                    {selectedEntity.type === 'target' && (
                        <button onClick={handleDeleteTarget} className="p-2.5 bg-gray-100 text-gray-500 rounded-xl hover:text-red-500 h-[44px]"><Trash2 size={20}/></button>
                    )}
                    {(selectedEntity.type === 'store' || selectedEntity.type === 'tobacco') && 
                      (selectedEntity.data.lat !== selectedEntity.data.origin_lat || selectedEntity.data.lng !== selectedEntity.data.origin_lng) && (
                        <button 
                          onClick={async () => {
                            if (!window.confirm('원래 위치로 되돌리시겠습니까?')) return;
                            const res = await resetEntityCoords(selectedEntity.type, selectedEntity.data.id);
                            if (res.success) {
                                if (selectedEntity.type === 'store') setStores(await getStores());
                                else setTobacco(await getTobaccoShops());
                                setSelectedEntity(null);
                            }
                          }}
                          className="p-2 px-3 bg-gray-100 text-gray-600 rounded-xl hover:text-blue-600 h-[44px] flex items-center gap-1.5 text-xs font-black"
                        >🔄 초기화</button>
                    )}
                    {selectedEntity.type !== 'location' && (
                        <button 
                          onClick={() => {
                            setRelocatingEntity(selectedEntity);
                            setSelectedEntity(null);
                          }}
                          className="p-2 px-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 h-[44px] flex items-center gap-1.5 text-xs font-black shadow-lg"
                        >📍 위치 이동</button>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  {/* 건축물대장 정보 Section (단순화 버전) */}
                  {(loadingBuilding || buildingInfo) && (
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 shadow-sm min-h-[80px] flex flex-col justify-center">
                        {loadingBuilding ? (
                            <div className="flex items-center justify-center gap-3 text-gray-400 py-4">
                                <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                                <span className="text-xs font-bold uppercase tracking-widest">건축HUB 확인 중...</span>
                            </div>
                        ) : buildingInfo?.error ? (
                            <div className="flex flex-col items-center justify-center gap-1 text-gray-400 py-4">
                                <Building2 size={24} className="opacity-20 mb-1"/>
                                <span className="text-[11px] font-black text-gray-300">조회 실패: {buildingInfo.error}</span>
                            </div>
                        ) : buildingInfo && (
                            <>
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
                                        <Building2 size={18} className="text-blue-500"/> 위반건축물 여부
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        {buildingInfo.isViolation === true ? (
                                            <span className="bg-red-500 text-white text-[11px] font-black px-3 py-1 rounded-full animate-pulse shadow-sm shadow-red-200">
                                                위반건축물 (확인됨)
                                            </span>
                                        ) : buildingInfo.isViolation === false ? (
                                            <span className="bg-emerald-500 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-sm shadow-emerald-100">
                                                정상건축물
                                            </span>
                                        ) : (
                                            <span className="bg-gray-400 text-white text-[11px] font-black px-3 py-1 rounded-full">
                                                판단불가
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2 flex justify-end items-center gap-2 text-[9px] text-gray-300 font-medium">
                                    <span>Source: {buildingInfo.source}</span>
                                    <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                    <span>Field: {buildingInfo.rawField} ({buildingInfo.rawValue})</span>
                                </div>
                            </>
                        )}
                    </div>
                  )}

                  {/* 순서: 상호 -> 주소 -> 인허가 정보 */}
                  {(selectedEntity.type === 'store' || selectedEntity.type === 'tobacco') && (
                    <div className="flex flex-wrap gap-2 text-sm font-medium">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                        <Building2 size={16} className="text-gray-500"/>
                        {selectedEntity.data.license_type || '일반소매인'}
                      </div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${selectedEntity.type === 'store' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                        <Calendar size={16}/> 인허가: {selectedEntity.data.designation_date || '-'}
                      </div>
                      {selectedEntity.type === 'store' && selectedEntity.data.expiration_date && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg">
                          <Calendar size={16}/> 만료일(5년): {selectedEntity.data.expiration_date}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedEntity.type === 'target' && (
                    <div className="space-y-1 text-sm bg-blue-50 p-3 rounded-lg text-blue-800">
                      <p><b>면적:</b> {selectedEntity.data.area_size} ㎡</p>
                      <p><b>예상 임대료:</b> {selectedEntity.data.rent_fee} 만원</p>
                    </div>
                  )}

                  {/* 순서: 경고 문구 */}
                  <div className="bg-red-50 p-2.5 rounded-lg border border-red-100">
                    <p className="text-red-600 text-[11px] font-black leading-tight">⚠️ 담배거리는 반드시 직접 측정해서 확인해주세요.</p>
                  </div>

                  {/* 순서: 가장 가까운 정보 */}
                  {locationInfo && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">가장 가까운 담배소매인</div>
                        {locationInfo.nearestTobacco ? (
                          <>
                            <div className="font-bold text-gray-800 truncate text-sm">{locationInfo.nearestTobacco.name}</div>
                            <div className="text-xs font-bold text-blue-600 mt-1">약 {locationInfo.nearestTobacco.distance}m</div>
                          </>
                        ) : <div className="text-xs text-gray-400">정보 없음</div>}
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">가장 가까운 편의점</div>
                        {locationInfo.nearestStore ? (
                          <>
                            <div className="font-bold text-gray-800 truncate text-sm">{locationInfo.nearestStore.name}</div>
                            <div className="text-xs font-bold text-orange-600 mt-1">약 {locationInfo.nearestStore.distance}m</div>
                          </>
                        ) : <div className="text-xs text-gray-400">정보 없음</div>}
                      </div>
                    </div>
                  )}
                </div>

                {/* 순서: 메모 기록 */}
                <div className="border-t border-gray-100 mt-6 pt-6">
                  <h3 className="font-bold text-gray-900 mb-3 ml-1">메모 기록</h3>
                  <div className="flex gap-2 mb-4 items-end">
                    <textarea 
                      value={memoInput} onChange={(e) => setMemoInput(e.target.value)}
                      placeholder="메모를 입력하세요"
                      className="flex-1 p-3 border border-gray-200 rounded-xl bg-gray-50/50 resize-none min-h-[70px] text-sm"
                    />
                    <button onClick={handleSaveMemo} disabled={!memoInput.trim()} className="bg-blue-600 text-white px-4 h-[70px] rounded-xl font-bold disabled:opacity-50">저장</button>
                  </div>
                  <div className="space-y-3 pb-10">
                    {memos.length === 0 ? <p className="text-center text-gray-400 py-6 text-sm bg-gray-50 rounded-xl">메모가 없습니다.</p> :
                      memos.map(m => (
                        <div key={m.id} className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/50 group">
                          {editingMemoId === m.id ? (
                              <div className="space-y-2">
                                  <textarea 
                                    value={editMemoInput} onChange={(e) => setEditMemoInput(e.target.value)}
                                    className="w-full p-2 border border-orange-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-300"
                                    autoFocus
                                  />
                                  <div className="flex justify-end gap-2">
                                      <button onClick={() => setEditingMemoId(null)} className="px-3 py-1 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-lg">취소</button>
                                      <button onClick={() => handleUpdateMemo(m.id)} className="px-3 py-1 text-xs font-bold text-white bg-blue-600 rounded-lg">저장</button>
                                  </div>
                              </div>
                          ) : (
                              <>
                                <div className="flex justify-between items-start gap-2">
                                    <p className="text-sm text-orange-900 leading-relaxed flex-1">{m.memo}</p>
                                    <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={() => { setEditingMemoId(m.id); setEditMemoInput(m.memo); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg"><Edit2 size={14}/></button>
                                        <button onClick={() => handleDeleteMemo(m.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                                <div className="text-[10px] text-orange-400 mt-2 font-medium">{new Date(m.created_at).toLocaleString()}</div>
                              </>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;
