// API Base URL - uses environment variable in production, falls back to hardcoded URL
// In Vercel, set VITE_API_BASE_URL environment variable to your Render backend URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tatvadirect.onrender.com';

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
