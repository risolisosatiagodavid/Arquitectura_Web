import type { Generated } from 'kysely';

export interface UserTable {
  id: Generated<number>;
  nombre: string;
  email: string;
  password_hash: string;
  domicilio: string;
  username: string | null;
  telefono: string | null;
  created_at: Generated<string>;
}