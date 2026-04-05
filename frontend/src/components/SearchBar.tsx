import { useState } from 'react';
import { Search, MapPin, X } from 'lucide-react';
import { useStore } from '../store';

const SearchBar = () => {
  const [query, setQuery] = useState('');
  const { stores, tobacco, setSearchResult, setSelectedEntity } = useStore();
  
  const handleSearch = () => {
    if (!query.trim() || !window.naver?.maps?.Service) return;
    
    const searchLower = query.toLowerCase().trim();
    
    // 1. Local Search by Store Name
    const foundStore = (stores as any[]).find((s: any) => s.name.toLowerCase().includes(searchLower));
    const foundTobacco = (tobacco as any[]).find((t: any) => t.name.toLowerCase().includes(searchLower));
    
    if (foundStore && foundStore.lat && foundStore.lng) {
      const coords = { lat: foundStore.lat, lng: foundStore.lng };
      setSearchResult(coords);
      setSelectedEntity({ type: 'store', data: foundStore });
      window.dispatchEvent(new CustomEvent('moveMap', { detail: coords }));
      return;
    }
    if (foundTobacco && foundTobacco.lat && foundTobacco.lng) {
      const coords = { lat: foundTobacco.lat, lng: foundTobacco.lng };
      setSearchResult(coords);
      setSelectedEntity({ type: 'tobacco', data: foundTobacco });
      window.dispatchEvent(new CustomEvent('moveMap', { detail: coords }));
      return;
    }

    // 2. Fallback to Naver Geocoder
    window.naver.maps.Service.geocode({ query: query }, (status: any, response: any) => {
      if (status !== window.naver.maps.Service.Status.OK || !response.v2.addresses.length) {
        alert('검색 결과를 찾을 수 없습니다 (주소 또는 상호명)');
        return;
      }
      
      const item = response.v2.addresses[0];
      const coords = { lat: parseFloat(item.y), lng: parseFloat(item.x) };
      const address = item.roadAddress || item.jibunAddress;
      
      setSearchResult(coords);
      setSelectedEntity({ 
        type: 'location', 
        data: { lat: coords.lat, lng: coords.lng, address: address } 
      });
      window.dispatchEvent(new CustomEvent('moveMap', { detail: coords }));
    });
  };

  const handleClear = () => {
    setQuery('');
    setSearchResult(null);
    setSelectedEntity(null);
  };

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[9001] w-[92%] sm:w-[400px]">
      <div className="flex items-center bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden group focus-within:ring-2 focus-within:ring-blue-500 transition-all h-14">
        <div className="pl-4 flex-shrink-0 text-gray-400 group-focus-within:text-blue-500 transition-colors">
          <MapPin size={22} />
        </div>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="도로명, 지번 주소 또는 상호명..."
          className="flex-1 w-0 min-w-0 h-full px-3 outline-none text-[16px] font-medium text-gray-800 placeholder-gray-400 bg-transparent notranslate"
          translate="no"
        />
        <div className="flex items-center flex-shrink-0">
            {query && (
            <button 
                onClick={handleClear}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
                <X size={20} />
            </button>
            )}
            <div className="h-6 w-[1px] bg-gray-100 mx-1"></div>
            <button 
            onClick={handleSearch}
            className="p-3 pr-4 text-gray-400 hover:text-blue-600 transition-colors"
            >
            <Search size={24} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
