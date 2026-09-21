import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { authenticateUser, findUserByEmail, registerUser } from '../services/user.service.js';

export const register = async (request: Request, response: Response) => {
  const { nombre, email, password, domicilio } = request.body ?? {};

  if (![nombre, email, password, domicilio].every((value) => typeof value === 'string' && value.trim())) {
    response.status(400).json({ error: 'nombre, email, password y domicilio son requeridos' });
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

  response.json({ token: jwt.sign({ sub: user.id }, env.jwtSecret) });
};