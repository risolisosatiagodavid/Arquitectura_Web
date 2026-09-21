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