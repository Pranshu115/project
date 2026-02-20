// API Base URL - using deployed backend on Render
export const API_BASE_URL = 'https://tatva-72l6.onrender.com';

// Helper function to create full API URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};
