import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { getStores, getTobaccoShops } from '../api';
import { Search, ArrowUpDown, Map as MapIcon, Building2, Cigarette, Info, Store } from 'lucide-react';
import { motion } from 'framer-motion';

const RetailerList = () => {
  const { setViewMode, setSelectedEntity } = useStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [stores, tobacco] = await Promise.all([getStores(), getTobaccoShops()]);
      const combined = [
        ...stores.map((s: any) => ({ 
          ...s, 
          type: 'store', 
          display_expiration: s.tobacco_expiration_date,
          display_license: s.license_type 
        })),
        ...tobacco.map((t: any) => ({ 
          ...t, 
          type: 'tobacco', 
          display_expiration: t.expiration_date,
          display_license: t.license_type
        }))
      ];
      setData(combined);
    } catch (err) {
      console.error('Failed to load list data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const filteredData = data
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const handleFocusOnMap = (item: any) => {
    setSelectedEntity({ type: item.type, data: item });
    setViewMode('map');
    // Global event to notify map to center
    window.dispatchEvent(new CustomEvent('focusMap', { detail: { lat: item.lat, lng: item.lng } }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-gray-50 z-30 flex flex-col pt-20 px-4 pb-4 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="text-blue-600" /> 담배소매인 지정현황
            </h1>
            <p className="text-gray-500 text-sm">전체 {filteredData.length}개의 점포가 검색되었습니다.</p>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="점포명 또는 주소 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-md z-10">
                <tr>
                  <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('type')}>
                    <div className="flex items-center gap-1">유형 <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">점포명 <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">주소</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">인허가구분</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('display_expiration')}>
                    <div className="flex items-center gap-1 text-red-500">만료일(5년) <ArrowUpDown size={14}/></div>
                  </th>
                  <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 text-center">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="p-8 bg-gray-50/50"></td>
                    </tr>
                  ))
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Info size={40} className="text-gray-200" />
                        <p>검색 결과가 없습니다.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(item => (
                    <tr key={`${item.type}-${item.id}`} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4">
                        {item.type === 'store' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md">
                            <Store size={12}/> {item.brand || '편의점'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-md">
                            <Cigarette size={12}/> 일반
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-gray-800">{item.name}</td>
                      <td className="p-4 text-sm text-gray-500">{item.address}</td>
                      <td className="p-4 text-sm text-gray-600 font-medium">
                        {item.display_license || '일반소매인'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-sm font-bold ${item.type === 'store' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50'}`}>
                          {item.display_expiration || '-'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleFocusOnMap(item)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all active:scale-90"
                          title="지도로 보기"
                        >
                          <MapIcon size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RetailerList;
