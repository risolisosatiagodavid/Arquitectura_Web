import type { Generated } from 'kysely';

export interface StoreTable {
  id: Generated<number>;
  store_name: string;
  descripcion: string;
  owner_id: number;
  visibilidad: 'publica' | 'privada';
  zona: string | null;
  categoria: string | null;
  telefono: string | null;
  created_at: Generated<string>;
}

export interface Database {
  users: import('./user.model.js').UserTable;
  stores: StoreTable;
}