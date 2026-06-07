import api from './api';
import { Trip, Expense, ExpenseInput, Location, CurrencyBalance, RecordedSettlement, TripParticipant, PlannerActivity, PlannerActivityInput, PlannerLog, LivePosition } from '../types';

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

  getSettlements: (tripId: string) =>
    api.get<RecordedSettlement[]>(`/trips/${tripId}/settlements`).then(r => r.data),
  createSettlement: (tripId: string, data: { fromUserId: string; toUserId: string; amount: number; currency: string }) =>
    api.post<RecordedSettlement>(`/trips/${tripId}/settlements`, data).then(r => r.data),
  deleteSettlement: (tripId: string, sid: string) => api.delete(`/trips/${tripId}/settlements/${sid}`),

  inviteParticipant: (tripId: string, email: string) =>
    api.post<TripParticipant>(`/trips/${tripId}/participants`, { email }).then(r => r.data),
  removeParticipant: (tripId: string, userId: string) =>
    api.delete(`/trips/${tripId}/participants/${userId}`),

  getLocations: (tripId: string) => api.get<Location[]>(`/trips/${tripId}/locations`).then(r => r.data),
  createLocation: (tripId: string, data: Partial<Location>) =>
    api.post<Location>(`/trips/${tripId}/locations`, data).then(r => r.data),
  deleteLocation: (tripId: string, lid: string) => api.delete(`/trips/${tripId}/locations/${lid}`),

  getPlanner: (tripId: string) => api.get<PlannerActivity[]>(`/trips/${tripId}/planner`).then(r => r.data),
  createPlannerActivity: (tripId: string, data: PlannerActivityInput) =>
    api.post<PlannerActivity>(`/trips/${tripId}/planner`, data).then(r => r.data),
  updatePlannerActivity: (tripId: string, aid: string, data: Partial<PlannerActivityInput>) =>
    api.put<PlannerActivity>(`/trips/${tripId}/planner/${aid}`, data).then(r => r.data),
  deletePlannerActivity: (tripId: string, aid: string) => api.delete(`/trips/${tripId}/planner/${aid}`),

  getPlannerLogs: (tripId: string) =>
    api.get<PlannerLog[]>(`/trips/${tripId}/planner/logs`).then(r => r.data),

  generateAiLocations: (tripId: string) =>
    api.post<{ locations: Location[] }>(`/trips/${tripId}/ai-locations`).then(r => r.data),

  getPositions: (tripId: string) =>
    api.get<LivePosition[]>(`/trips/${tripId}/positions`).then(r => r.data),
  sendPosition: (tripId: string, lat: number, lng: number) =>
    api.post(`/trips/${tripId}/positions`, { lat, lng }),
  stopSharingPosition: (tripId: string) => api.delete(`/trips/${tripId}/positions`),
};
