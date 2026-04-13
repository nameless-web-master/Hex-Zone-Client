import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://hex-zone-server.onrender.com';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zoneweaver_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  account_type: 'private' | 'exclusive';
  phone?: string;
  zone_id?: string;
  address?: string;
}

export async function login(payload: LoginPayload) {
  return api.post('/owners/login', payload).then((res) => res.data);
}

export async function register(payload: RegisterPayload) {
  return api.post('/owners/register', payload).then((res) => res.data);
}

export async function fetchMe() {
  return api.get('/owners/me').then((res) => res.data);
}

export async function fetchDevices() {
  return api.get('/devices/').then((res) => res.data);
}

export async function fetchZones() {
  return api.get('/zones/').then((res) => res.data);
}

export async function fetchZonesByOwner(ownerId: number | string) {
  return api.get('/zones', { params: { owner_id: ownerId } }).then((res) => res.data);
}

export async function createZone(payload: any) {
  return api.post('/zones', payload).then((res) => res.data);
}

export async function updateZone(id: number | string, payload: any) {
  return api.patch(`/zones/${id}`, payload).then((res) => res.data);
}

export async function convertH3(latitude: number, longitude: number, resolution = 13) {
  return api.post('/utils/h3/convert', { latitude, longitude, resolution }).then((res) => res.data);
}

export async function updateDeviceLocation(id: number | string, payload: { latitude: number; longitude: number; address?: string }) {
  return api.post(`/devices/${id}/location`, payload).then((res) => res.data);
}

export async function fetchDeviceByHid(hid: string) {
  return api.get(`/devices/network/hid/${hid}`).then((res) => res.data);
}

export default api;
