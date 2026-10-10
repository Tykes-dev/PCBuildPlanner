import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || (window.location.protocol + '//' + window.location.hostname + ':3001/api'), timeout: 15000, withCredentials: true });
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'The request timed out. Try again.' : 'Cannot reach the API. Start the backend and check its MongoDB connection.');
  return error instanceof Error ? error.message : 'Something went wrong.';
}

