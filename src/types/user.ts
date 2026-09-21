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