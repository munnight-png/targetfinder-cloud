import MapContainer from './components/MapContainer';
import BottomSheet from './components/BottomSheet';
import FloatingMenu from './components/FloatingMenu';
import RetailerList from './components/RetailerList';
import GeocodeSync from './components/GeocodeSync';
import ContextMenu from './components/ContextMenu';
import Login from './components/Login';
import { useStore } from './store';
import SearchBar from './components/SearchBar';

function App() {
  const { viewMode, isAuthorized } = useStore();

  if (!isAuthorized) {
    return <Login />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-50 select-none">
      <MapContainer />
      <SearchBar />
      <GeocodeSync />
      {viewMode === 'list' && <RetailerList />}
      
      <FloatingMenu />
      <BottomSheet />
      <ContextMenu />
    </div>
  );
}

export default App;
