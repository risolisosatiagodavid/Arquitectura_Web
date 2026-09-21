export type StoreVisibility = 'publica' | 'privada';

export interface Store {
  id: number;
  storename: string;
  descripcion: string;
  owner: number;
  visibilidad: StoreVisibility;
  zona?: string;
  categoria?: string;
  telefono?: string;
}


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