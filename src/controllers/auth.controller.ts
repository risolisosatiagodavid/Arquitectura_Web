import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

import { authenticateUser, findUserByEmail, registerUser } from '../services/user.service.js';
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from '../utils/session.js';

type PublicUser = Omit<NonNullable<Awaited<ReturnType<typeof authenticateUser>>>, 'passwordHash'>;

const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true'
    || (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_MS,
});

const toPublicUser = (
  user: NonNullable<Awaited<ReturnType<typeof authenticateUser>>>,
): PublicUser => {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
};

const setSessionCookie = (response: Response, userId: number) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return false;
  }

  const token = jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '1h' });
  response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return true;
};

export const register = async (request: Request, response: Response) => {
  const { nombre, email, password, domicilio } = request.body ?? {};

  if (![nombre, email, password, domicilio].every((value) => typeof value === 'string' && value.trim())) {
    response.status(400).json({ error: 'nombre, email, password y domicilio son requeridos' });
    return;
  }

  if (!process.env.JWT_SECRET) {
    response.status(500).json({ error: 'JWT_SECRET no está configurado' });
    return;
  }

  if (await findUserByEmail(email)) {
    response.status(409).json({ error: 'El email ya esta registrado' });
    return;
  }

  const user = await registerUser({ nombre, email, password, domicilio });

  if (!user) {
    response.status(409).json({ error: 'El email ya esta registrado' });
    return;
  }

  if (!setSessionCookie(response, user.id)) {
    response.status(500).json({ error: 'JWT_SECRET no está configurado' });
    return;
  }

  response.status(201).json(user);
};

export const login = async (request: Request, response: Response) => {
  const { email, password } = request.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    response.status(400).json({ error: 'email y password son requeridos' });
    return;
  }

  const user = await authenticateUser(email, password);

  if (!user) {
    response.status(401).json({ error: 'Credenciales invalidas' });
    return;
  }

  if (!setSessionCookie(response, user.id)) {
    response.status(500).json({ error: 'JWT_SECRET no está configurado' });
    return;
  }

  response.json({ user: toPublicUser(user) });
};

export const session = (request: Request, response: Response) => {
  if (!request.authenticatedUser) {
    response.status(401).json({ error: 'Autenticacion requerida' });
    return;
  }

  response.json({ user: toPublicUser(request.authenticatedUser) });
};

export const logout = (_request: Request, response: Response) => {
  const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions();
  response.clearCookie(SESSION_COOKIE_NAME, clearOptions);
  response.status(204).send();
};