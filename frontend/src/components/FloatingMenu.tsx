import { useState } from 'react';
import { useStore } from '../store';
import { 
  Layers, Store, Cigarette, Star, Ruler, Locate, 
  BarChart3, Database, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FloatingMenu = () => {
  const { 
    showAreas, showStores, showTobacco, showTargets, measureMode, viewMode, 
    showMarketStatus, showCadastral,
    toggleLayer, setShowAreas, setViewMode, setShowMarketStatus
  } = useStore();

  const [menuOpen, setMenuOpen] = useState(false);

  const getBtnClass = (active: boolean) => 
    `w-12 h-12 rounded-full shadow-lg transition-all active:scale-90 flex items-center justify-center border-2 select-none touch-manipulation pointer-events-auto ${
      active ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/95 text-gray-700 border-transparent hover:bg-gray-50 backdrop-blur-md'
    }`;

  return (
    <>
      {/* Right Side Control Panel */}
      <div className="absolute top-[160px] right-4 flex flex-col gap-3 z-40 items-end pointer-events-none">
        {/* Layer Group */}
        <div className="flex flex-row-reverse items-center gap-3">
            <button 
                className={`w-12 h-12 rounded-full shadow-2xl transition-all active:scale-90 flex items-center justify-center border-2 z-50 select-none touch-manipulation pointer-events-auto ${menuOpen ? 'bg-gray-800 text-white border-gray-600' : 'bg-white text-gray-800 border-gray-200'}`}
                onClick={() => setMenuOpen(!menuOpen)}
                title="레이어 설정"
            >
                {menuOpen ? <X size={24} /> : <Layers size={24} />}
            </button>

            <AnimatePresence>
                {menuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.8 }}
                        className="flex flex-row gap-2"
                    >
                        <button className={getBtnClass(showCadastral)} onClick={() => toggleLayer('showCadastral')} title="지적도">
                            <div className="font-bold text-[9px] leading-tight text-center">지적<br/>도</div>
                        </button>
                        <button className={getBtnClass(showStores)} onClick={() => toggleLayer('showStores')} title="편의점">
                            <Store size={20} />
                        </button>
                        <button className={getBtnClass(showTobacco)} onClick={() => toggleLayer('showTobacco')} title="담배소매인">
                            <Cigarette size={20} />
                        </button>
                        <button 
                            className={`w-12 h-12 rounded-full shadow-lg transition-all active:scale-90 flex items-center justify-center border-2 select-none touch-manipulation pointer-events-auto ${showTargets ? 'bg-pink-600 text-white border-pink-400' : 'bg-white/95 text-gray-700 border-transparent hover:bg-gray-50 backdrop-blur-md'}`}
                            onClick={() => toggleLayer('showTargets')} 
                            title="타겟 후보지"
                        >
                            <Star size={20} />
                        </button>
                        <button 
                            className={`w-12 h-12 rounded-full shadow-lg transition-all active:scale-90 flex flex-col items-center justify-center border-2 select-none touch-manipulation pointer-events-auto ${
                                showAreas ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/95 text-gray-700 border-transparent hover:bg-gray-50 backdrop-blur-md'
                            }`}
                            onClick={() => setShowAreas(!showAreas)} 
                            title={`제한 구역: ${showAreas ? '표시 중' : '숨김'}`}
                        >
                            <div className="font-bold text-[9px] leading-tight text-center">
                                제한<br/>구역
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
        
        {/* Tool Buttons - Now Stacked Vertically on the Right */}
        <button 
            className={getBtnClass(measureMode)} 
            onClick={() => toggleLayer('measureMode')}
            title="거리 측정"
        >
            <Ruler size={24} />
        </button>
        
        <button 
            className={getBtnClass(false)} 
            onClick={() => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                        window.dispatchEvent(new CustomEvent('moveMap', { 
                            detail: { lat: pos.coords.latitude, lng: pos.coords.longitude } 
                        }));
                    }, (err) => {
                        console.error('Location error:', err);
                        alert('위치 정보를 가져올 수 없습니다. 권한 설정을 확인해주세요.');
                    });
                } else {
                    alert('이 브라우저는 GPS 기능을 지원하지 않습니다.');
                }
            }}
            title="현재 위치로"
        >
            <Locate size={24} />
        </button>

        <button 
            className={getBtnClass(showMarketStatus)} 
            onClick={() => setShowMarketStatus(!showMarketStatus)}
            title="시장 현황"
        >
            <BarChart3 size={24} />
        </button>

        <button 
            className={`w-12 h-12 rounded-full shadow-2xl transition-all active:scale-95 flex items-center justify-center border-2 border-white/50 text-white select-none touch-manipulation pointer-events-auto ${viewMode === 'list' ? 'bg-gray-800' : 'bg-blue-600'}`}
            onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            title={viewMode === 'list' ? '지도로 돌아가기' : '데이터 리스트'}
        >
            {viewMode === 'list' ? <Layers size={24} /> : <Database size={24} />}
        </button>
      </div>
    </>
  );
};

export default FloatingMenu;
