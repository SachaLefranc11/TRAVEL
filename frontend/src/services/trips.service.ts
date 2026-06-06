import api from './api';
import { Trip, Expense, ExpenseInput, Location, CurrencyBalance, TripParticipant } from '../types';

export const tripsService = {
  getAll: () => api.get<Trip[]>('/trips').then(r => r.data),
  getOne: (id: string) => api.get<Trip>(`/trips/${id}`).then(r => r.data),
  create: (data: Partial<Trip>) => api.post<Trip>('/trips', data).then(r => r.data),
  update: (id: string, data: Partial<Trip>) => api.put<Trip>(`/trips/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/trips/${id}`),

  getExpenses: (tripId: string) => api.get<Expense[]>(`/trips/${tripId}/expenses`).then(r => r.data),
  createExpense: (tripId: string, data: ExpenseInput) =>
    api.post<Expense>(`/trips/${tripId}/expenses`, data).then(r => r.data),
  updateExpense: (tripId: string, eid: string, data: Partial<ExpenseInput>) =>
    api.put<Expense>(`/trips/${tripId}/expenses/${eid}`, data).then(r => r.data),
  deleteExpense: (tripId: string, eid: string) => api.delete(`/trips/${tripId}/expenses/${eid}`),

  getBalances: (tripId: string) => api.get<CurrencyBalance[]>(`/trips/${tripId}/balances`).then(r => r.data),

  inviteParticipant: (tripId: string, email: string) =>
    api.post<TripParticipant>(`/trips/${tripId}/participants`, { email }).then(r => r.data),
  removeParticipant: (tripId: string, userId: string) =>
    api.delete(`/trips/${tripId}/participants/${userId}`),

  getLocations: (tripId: string) => api.get<Location[]>(`/trips/${tripId}/locations`).then(r => r.data),
  createLocation: (tripId: string, data: Partial<Location>) =>
    api.post<Location>(`/trips/${tripId}/locations`, data).then(r => r.data),
  deleteLocation: (tripId: string, lid: string) => api.delete(`/trips/${tripId}/locations/${lid}`),
};
