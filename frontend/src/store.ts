import { create } from 'zustand';
import type { SelectedEntity } from './types';

interface AppState {
  showAreas: boolean;
  showStores: boolean;
  showTobacco: boolean;
  showTargets: boolean;
  measureMode: boolean;
  viewMode: 'map' | 'list';
  selectedEntity: SelectedEntity | null;
  mapZoom: number;
  stores: any[];
  tobacco: any[];
  searchResult: { lat: number, lng: number } | null;
  analysisRadius: number;
  showWalkingRadius: boolean;
  showMarketStatus: boolean;
  targets: any[];
  showCadastral: boolean;
  relocatingEntity: SelectedEntity | null;
  restrictedAreas: any;
  isAuthorized: boolean;
  masterPassword: string | null;
  
  setShowAreas: (show: boolean) => void;
  setAuthorized: (authorized: boolean, password: string | null) => void;
  toggleLayer: (layer: 'showStores' | 'showTobacco' | 'showTargets' | 'measureMode' | 'showCadastral' | 'showAreas') => void;
  setSelectedEntity: (entity: SelectedEntity | null) => void;
  setRelocatingEntity: (entity: SelectedEntity | null) => void;
  setMapZoom: (zoom: number) => void;
  setViewMode: (mode: 'map' | 'list') => void;
  setStores: (stores: any[]) => void;
  setTobacco: (tobacco: any[]) => void;
  setTargets: (targets: any[]) => void;
  setRestrictedAreas: (areas: any) => void;
  setSearchResult: (result: { lat: number, lng: number } | null) => void;
  setAnalysisRadius: (radius: number) => void;
  setShowWalkingRadius: (show: boolean) => void;
  setShowMarketStatus: (show: boolean) => void;
  contextMenu: { visible: boolean, x: number, y: number, lat: number, lng: number } | null;
  setContextMenu: (menu: { visible: boolean, x: number, y: number, lat: number, lng: number } | null) => void;
}

export const useStore = create<AppState>((set) => ({
  showAreas: false,
  showStores: true,
  showTobacco: true,
  showTargets: true,
  measureMode: false,
  viewMode: 'map',
  selectedEntity: null,
  mapZoom: 14,
  stores: [],
  tobacco: [],
  searchResult: null,
  analysisRadius: 100,
  showWalkingRadius: false,
  showMarketStatus: false,
  targets: [],
  contextMenu: null,
  showCadastral: false,
  relocatingEntity: null,
  restrictedAreas: null,
  isAuthorized: !!localStorage.getItem('targetfinder_pass'),
  masterPassword: localStorage.getItem('targetfinder_pass'),
  setShowAreas: (show) => set({ showAreas: show }),
  setAuthorized: (authorized, password) => {
    if (authorized && password) {
        localStorage.setItem('targetfinder_pass', password);
    } else {
        localStorage.removeItem('targetfinder_pass');
    }
    set({ isAuthorized: authorized, masterPassword: password });
  },
  toggleLayer: (layer) => set((state: any) => ({ [layer]: !state[layer] })),
  setSelectedEntity: (entity) => set({ selectedEntity: entity, showMarketStatus: false, contextMenu: null }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setStores: (stores) => set({ stores }),
  setTobacco: (tobacco) => set({ tobacco }),
  setTargets: (targets) => set({ targets }),
  setRestrictedAreas: (areas) => set({ restrictedAreas: areas }),
  setSearchResult: (result) => set({ searchResult: result }),
  setAnalysisRadius: (radius) => set({ analysisRadius: radius }),
  setShowWalkingRadius: (show) => set({ showWalkingRadius: show }),
  setShowMarketStatus: (show) => set({ showMarketStatus: show, selectedEntity: show ? null : null }),
  setRelocatingEntity: (entity) => set({ relocatingEntity: entity }),
  setContextMenu: (menu) => set({ contextMenu: menu })
}));
