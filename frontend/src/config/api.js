// API Base URL - uses environment variable in production, falls back to hardcoded URL
// In Vercel, set VITE_API_BASE_URL environment variable to your Render backend URL
const envApiUrl = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL = envApiUrl && envApiUrl.trim() !== '' 
  ? envApiUrl.trim().replace(/\/$/, '') // Remove trailing slash if present
  : 'https://tatvadirect.onrender.com';

// Log for debugging (only in development)
if (import.meta.env.DEV) {
  console.log('API Configuration:', {
    envVar: import.meta.env.VITE_API_BASE_URL,
    finalUrl: API_BASE_URL
  });
}

// Helper function to create full API URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

// Helper function for fetch calls with authentication
export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const url = getApiUrl(endpoint);
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw { status: response.status, ...errorData };
  }

  return response.json();
};
