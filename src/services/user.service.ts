import { createHash, timingSafeEqual } from 'node:crypto';

import type { RegisterUserInput, UpdateUserInput, User } from '../types/user.js';

const users: User[] = [];
let nextUserId = 1;

const hashPassword = (password: string): string =>
  createHash('sha256').update(password).digest('hex');

const toPublicUser = ({ passwordHash: _passwordHash, ...user }: User) => user;

export const registerUser = (input: RegisterUserInput) => {
  const normalizedEmail = input.email.trim().toLowerCase();

  if (users.some((user) => user.email === normalizedEmail)) {
    return undefined;
  }

  const user: User = {
    id: nextUserId++,
    nombre: input.nombre.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(input.password),
    domicilio: input.domicilio.trim(),
  };

  users.push(user);
  return toPublicUser(user);
};

export const authenticateUser = (email: string, password: string) => {
  const user = users.find((candidate) => candidate.email === email.trim().toLowerCase());

  if (!user) {
    return undefined;
  }

  const expectedHash = Buffer.from(user.passwordHash, 'hex');
  const receivedHash = Buffer.from(hashPassword(password), 'hex');

  return expectedHash.length === receivedHash.length && timingSafeEqual(expectedHash, receivedHash)
    ? user
    : undefined;
};

export const findUserById = (id: number) => users.find((user) => user.id === id);

export const updateUser = (user: User, input: UpdateUserInput) => {
  Object.assign(user, input);
  return toPublicUser(user);
};