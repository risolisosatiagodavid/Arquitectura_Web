export interface User {
  id: number;
  nombre: string;
  email: string;
  passwordHash: string;
  domicilio: string;
  username?: string;
  telefono?: string;
}