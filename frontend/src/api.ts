import axios from 'axios';
import { useStore } from './store';

const VITE_API_URL = import.meta.env.VITE_API_URL;
const BASE_URL = VITE_API_URL !== undefined && VITE_API_URL !== null ? VITE_API_URL : `http://${window.location.hostname}:3001`;
// Ensure no double slashes when joining
const API_URL = `${BASE_URL.replace(/\/$/, '')}/api`;

// 🔐 Inject Master Password into every request
axios.interceptors.request.use((config) => {
    const pass = useStore.getState().masterPassword;
    if (pass) {
        config.headers['Authorization'] = pass;
    }
    return config;
});

export const getStores = async () => (await axios.get(`${API_URL}/stores`)).data;
export const getTobaccoShops = async () => (await axios.get(`${API_URL}/tobacco`)).data;
export const getTargets = async () => (await axios.get(`${API_URL}/targets`)).data;
export const getRestrictedAreas = async (mode: string = 'on') => (await axios.get(`${API_URL}/areas?mode=${mode}`)).data;
export const getStats = async () => (await axios.get(`${API_URL}/stats`)).data;
export const getMemos = async (type: string, id: number) => (await axios.get(`${API_URL}/memos?type=${type}&id=${id}`)).data;
export const saveMemo = async (type: string, id: number, memo: string) => await axios.post(`${API_URL}/memos`, { entity_type: type, entity_id: id, memo });
export const updateMemo = async (id: number, memo: string) => await axios.put(`${API_URL}/memos/${id}`, { memo });
export const deleteMemo = async (id: number) => await axios.delete(`${API_URL}/memos/${id}`);
export const updateEntityName = async (type: string, id: number, name: string) => await axios.post(`${API_URL}/entities/update-name`, { type, id, name });
export const updateStoreCoords = async (id: number, lat: number, lng: number) => await axios.post(`${API_URL}/stores/update-coords`, { id, lat, lng });
export const updateTobaccoCoords = async (id: number, lat: number, lng: number) => await axios.post(`${API_URL}/tobacco/update-coords`, { id, lat, lng });
export const resetEntityCoords = async (type: string, id: number) => (await axios.post(`${API_URL}/entities/reset-coords`, { type, id })).data;
export const toggleEntityTarget = async (type: string, id: number, is_target: boolean) => await axios.post(`${API_URL}/entities/toggle-target`, { type, id, is_target });
export const saveTarget = async (data: any) => (await axios.post(`${API_URL}/targets`, data)).data;
export const deleteTarget = async (id: number) => (await axios.delete(`${API_URL}/targets/${id}`)).data;
export const getReverseGeocode = async (lat: number, lng: number) => (await axios.get(`${API_URL}/reverse-geocode?lat=${lat}&lng=${lng}`)).data;
export const getBuildingLedger = async (lat: number, lng: number, codeInfo?: any) => {
    let url = `${API_URL}/building-ledger?lat=${lat}&lng=${lng}`;
    if (codeInfo) {
        Object.keys(codeInfo).forEach(key => {
            if (codeInfo[key]) url += `&${key}=${codeInfo[key]}`;
        });
    }
    return (await axios.get(url)).data;
};
