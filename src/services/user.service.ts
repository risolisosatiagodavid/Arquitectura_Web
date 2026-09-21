import argon2 from 'argon2';

import { db } from '../config/database.js';
import type { User } from '../types/user.js';
import type { RegisterUserInput, UpdateUserInput } from '../types/user.js';

type UserRow = {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  domicilio: string;
  username: string | null;
  telefono: string | null;
};

const toUser = (row: UserRow): User => ({
  id: row.id,
  nombre: row.nombre,
  email: row.email,
  passwordHash: row.password_hash,
  domicilio: row.domicilio,
  ...(row.username !== null && { username: row.username }),
  ...(row.telefono !== null && { telefono: row.telefono }),
});

const toPublicUser = ({ passwordHash: _passwordHash, ...user }: User) => user;

export const registerUser = async (input: RegisterUserInput) => {
  const normalizedEmail = input.email.trim().toLowerCase();
  const passwordHash = await argon2.hash(input.password);
  const row = await db.insertInto('users')
    .values({
      nombre: input.nombre.trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      domicilio: input.domicilio.trim(),
      username: null,
      telefono: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toPublicUser(toUser(row));
};

export const authenticateUser = async (email: string, password: string) => {
  const row = await db.selectFrom('users')
    .selectAll()
    .where('email', '=', email.trim().toLowerCase())
    .executeTakeFirst();

  if (!row || !(await argon2.verify(row.password_hash, password))) {
    return undefined;
  }

  return toUser(row);
};

export const findUserByEmail = async (email: string) => {
  const row = await db.selectFrom('users')
    .selectAll()
    .where('email', '=', email.trim().toLowerCase())
    .executeTakeFirst();

  return row ? toUser(row) : undefined;
};

export const findUserById = async (id: number) => {
  const row = await db.selectFrom('users')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  return row ? toUser(row) : undefined;
};

export const updateUser = async (id: number, input: UpdateUserInput) => {
  const row = await db.updateTable('users')
    .set(input)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return toPublicUser(toUser(row));
};
