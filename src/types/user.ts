export interface User {
  id: number;
  nombre: string;
  email: string;
  passwordHash: string;
  domicilio: string;
  username?: string;
  telefono?: string;
}

export interface RegisterUserInput {
  nombre: string;
  email: string;
  password: string;
  domicilio: string;
}

export interface UpdateUserInput {
  username?: string;
  telefono?: string;
  domicilio?: string;
}