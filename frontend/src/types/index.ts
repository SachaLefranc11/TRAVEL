export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  coverImage?: string;
  startDate: string;
  endDate: string;
  description?: string;
  createdAt: string;
  ownerId: string;
  participants: TripParticipant[];
  expenses?: Expense[];
  locations?: Location[];
  _count?: { expenses: number; locations: number };
}

export interface TripParticipant {
  id: string;
  userId: string;
  tripId: string;
  role: 'OWNER' | 'MEMBER';
  user: Pick<User, 'id' | 'name' | 'email' | 'avatar'>;
}

export type ExpenseCategory = 'TRANSPORT' | 'ACCOMMODATION' | 'FOOD' | 'ACTIVITIES' | 'OTHER';

export interface ExpenseShare {
  id: string;
  expenseId: string;
  userId: string;
  amount: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
  notes?: string;
  paidById: string;
  tripId: string;
  createdAt: string;
  paidBy: Pick<User, 'id' | 'name' | 'avatar'>;
  shares?: ExpenseShare[];
}

export type SplitType = 'PERSONAL' | 'EQUAL' | 'CUSTOM';

/** Payload d'envoi d'une dépense (création/édition). */
export interface ExpenseInput {
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
  notes?: string;
  paidById?: string;
  splitType?: SplitType;
  participantIds?: string[];
  shares?: { userId: string; amount: number }[];
}

export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface CurrencyBalance {
  currency: string;
  balances: { userId: string; amount: number }[];
  settlements: Settlement[];
}

export type LocationType = 'ATTRACTION' | 'RESTAURANT' | 'HOTEL' | 'ACTIVITY' | 'OTHER';

export interface Location {
  id: string;
  tripId: string;
  name: string;
  type: LocationType;
  lat: number;
  lng: number;
  description?: string;
  address?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
