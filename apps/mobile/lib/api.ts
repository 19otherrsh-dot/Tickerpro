// Hardcoded token for demo/development purposes since we don't have a login screen yet.
const DEV_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzEiLCJ3b3Jrc3BhY2VJZCI6IndzXzEifQ.xxxxxx";

// In Expo, localhost works for iOS Simulator, but Android Emulator needs 10.0.2.2.
// For physical devices, you need your machine's local IP (e.g. 192.168.1.x)
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${DEV_TOKEN}`);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  
  if (!res.ok) {
    let errMessage = 'API Error';
    try {
      const errData = await res.json();
      errMessage = errData.error || errData.message || 'API Error';
    } catch {
      errMessage = await res.text() || res.statusText;
    }
    throw new Error(errMessage);
  }

  // Not all endpoints return JSON
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}
