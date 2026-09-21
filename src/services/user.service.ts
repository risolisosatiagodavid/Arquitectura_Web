import argon2 from 'argon2';

import type { User } from '../models/user.model.js';
import type { RegisterUserInput, UpdateUserInput } from '../types/user.js';

const users: User[] = [];
let nextUserId = 1;

const toPublicUser = ({ passwordHash: _passwordHash, ...user }: User) => user;

export const registerUser = async (input: RegisterUserInput) => {
  const normalizedEmail = input.email.trim().toLowerCase();

  if (users.some((user) => user.email === normalizedEmail)) {
    return undefined;
  }

  const user: User = {
    id: nextUserId++,
    nombre: input.nombre.trim(),
    email: normalizedEmail,
    passwordHash: await argon2.hash(input.password),
    domicilio: input.domicilio.trim(),
  };

  users.push(user);
  return toPublicUser(user);
};

export const authenticateUser = async (email: string, password: string) => {
  const user = users.find((candidate) => candidate.email === email.trim().toLowerCase());

  if (!user) {
    return undefined;
  }

  return await argon2.verify(user.passwordHash, password) ? user : undefined;
};

export const findUserById = (id: number) => users.find((user) => user.id === id);

export const updateUser = (user: User, input: UpdateUserInput) => {
  Object.assign(user, input);
  return toPublicUser(user);
};