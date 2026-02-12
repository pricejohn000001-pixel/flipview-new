// src/utils/api.js
import axios from "axios";

// Create an Axios instance
const api = axios.create({
  baseURL: process.env.BACKEND_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 seconds timeout
});

// Request interceptor (optional)
api.interceptors.request.use(
  (config) => {
    // Add auth token dynamically from storage
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (token) {
      // Use bracket notation for compatibility with different Axios versions
      config.headers["Authorization"] = `Bearer ${token}`;
    } else if (process.env.REACT_APP_API_TOKEN) {
      config.headers["Authorization"] = `Bearer ${process.env.REACT_APP_API_TOKEN}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (optional)
api.interceptors.response.use(
  (response) => response.data, // return only the data
  (error) => {
    const message = error.response?.data?.message || error.message;
    return Promise.reject(new Error(message));
  }
);

// Generic CRUD methods
export const apiGet = (url, params) => api.get(url, { params });
export const apiPost = (url, data) => api.post(url, data);
export const apiPut = (url, data) => api.put(url, data);
export const apiPatch = (url, data) => api.patch(url, data);
export const apiDelete = (url) => api.delete(url);

export default api;
