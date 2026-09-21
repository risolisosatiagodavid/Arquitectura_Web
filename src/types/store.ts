import type { StoreVisibility } from '../models/store.model.js';

export type { StoreVisibility } from '../models/store.model.js';

export interface CreateStoreInput {
  storename: string;
  descripcion: string;
  owner: number;
  visibilidad: StoreVisibility;
  zona?: string;
  categoria?: string;
  telefono?: string;
}

export interface UpdateStoreInput {
  nombre?: string;
  descripcion?: string;
  telefono?: string;
  visibilidad?: StoreVisibility;
  zona?: string;
  categoria?: string;
}