import api from './api';

export interface ActivitySuggestion {
  name: string;
  description: string;
  category: 'ATTRACTION' | 'RESTAURANT' | 'HOTEL' | 'ACTIVITY' | 'OTHER';
  lat?: number;
  lng?: number;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  zoom: number;
}

export const aiService = {
  getDestinationImage: (q: string) =>
    api.get<{ imageUrl: string | null }>('/ai/destination-image', { params: { q } }).then(r => r.data),

  geocode: (q: string) =>
    api.get<GeocodeResult>('/ai/geocode', { params: { q } }).then(r => r.data),

  getActivities: (dest: string) =>
    api.get<{ destination: string; activities: ActivitySuggestion[] }>('/ai/activities', { params: { dest } }).then(r => r.data),

  uploadTripImage: (tripId: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<{ id: string; coverImage: string }>(`/ai/trips/${tripId}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};
