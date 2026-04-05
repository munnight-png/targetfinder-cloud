import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { MapPin, Target, X } from 'lucide-react';

const ContextMenu = () => {
  const { contextMenu, setContextMenu, setSelectedEntity } = useStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu?.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  if (!contextMenu || !contextMenu.visible) return null;

  // Screen boundary logic
  const menuWidth = 208; // w-52 = 13rem = 208px
  const menuHeight = 160; // Approximate height
  
  let top = contextMenu.y;
  let left = contextMenu.x;
  
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10;
  }
  if (top + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 10;
  }

  const handleViewInfo = () => {
    setSelectedEntity({
      type: 'location',
      data: { lat: contextMenu.lat, lng: contextMenu.lng }
    });
    setContextMenu(null);
  };

  const handleSetTarget = () => {
    // This will open the BottomSheet in 'location' mode, 
    // and we'll add a 'Save as Target' button there.
    setSelectedEntity({
      type: 'location',
      data: { lat: contextMenu.lat, lng: contextMenu.lng, autoSave: true }
    });
    setContextMenu(null);
  };

  return (
    <div 
      ref={menuRef}
      className="fixed z-[1000] bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-52 overflow-hidden animate-in fade-in zoom-in duration-200"
      style={{ top: top, left: left }}
    >
      <div className="px-4 py-2 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">위치 메뉴</span>
        <button onClick={() => setContextMenu(null)} className="text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
      
      <button 
        onClick={handleViewInfo}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
      >
        <MapPin size={18} className="text-blue-500" />
        이 위치 정보 보기
      </button>
      
      <button 
        onClick={handleSetTarget}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-pink-50 hover:text-pink-600 transition-colors border-b border-gray-50"
      >
        <Target size={18} className="text-pink-500" />
        타겟 후보로 설정
      </button>

      <button 
        onClick={() => {
          setSelectedEntity(null);
          window.dispatchEvent(new CustomEvent('openPano', { detail: { lat: contextMenu.lat, lng: contextMenu.lng } }));
          setContextMenu(null);
        }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors"
      >
        <div className="w-[18px] h-[18px] bg-green-500 rounded-sm flex items-center justify-center text-[10px] text-white font-bold">뷰</div>
        이 위치 로드뷰 보기
      </button>
    </div>
  );
};

export default ContextMenu;
