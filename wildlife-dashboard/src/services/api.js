import axios from 'axios';

// Flask backend URL (change if different)
const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Alert endpoints
export const alertApi = {
  // Get all alerts with filters
  getAlerts: (filters = {}) => 
    api.get('/alerts', { params: filters }),
  
  // Get specific alert
  getAlert: (id) => 
    api.get(`/alerts/${id}`),
  
  // Update alert status
  updateAlert: (id, data) => 
    api.put(`/alerts/${id}`, data),
  
  // Get statistics
  getStats: () => 
    api.get('/stats'),
  
  // Get species list
  getSpecies: () => 
    api.get('/species'),
  
  // Check backend health
  healthCheck: () => 
    axios.get('http://localhost:5000/health'),
};

// For testing connection
export const testBackendConnection = async () => {
  try {
    const response = await axios.get('http://localhost:5000/health');
    return {
      connected: true,
      data: response.data,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
};

export default api;