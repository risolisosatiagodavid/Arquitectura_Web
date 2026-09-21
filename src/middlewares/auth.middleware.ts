import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { findUserById } from '../services/user.service.js';

const authenticateRequest = async (request: Request, token: string) => {
  const payload = jwt.verify(token, env.jwtSecret);
  const userId = typeof payload === 'object' && payload !== null ? payload.sub : undefined;
  const user = userId ? await findUserById(Number(userId)) : undefined;

  if (user) {
    request.authenticatedUser = user;
  }

  return user;
};

export const requireAuth = async (request: Request, response: Response, next: NextFunction) => {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;

  if (!token) {
    response.status(401).json({ error: 'Token de autenticacion requerido' });
    return;
  }

  try {
    const user = await authenticateRequest(request, token);

    if (!user) {
      response.status(401).json({ error: 'Token invalido' });
      return;
    }

    request.authenticatedUser = user;
    next();
  } catch {
    response.status(401).json({ error: 'Token invalido' });
  }
};

export const optionalAuth = async (request: Request, response: Response, next: NextFunction) => {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;

  if (!token) {
    next();
    return;
  }

  try {
    if (!await authenticateRequest(request, token)) {
      response.status(401).json({ error: 'Token invalido' });
      return;
    }

    next();
  } catch {
    response.status(401).json({ error: 'Token invalido' });
  }
};