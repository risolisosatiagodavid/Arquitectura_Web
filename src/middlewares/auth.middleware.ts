import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { findUserById } from '../services/user.service.js';

export const requireAuth = (request: Request, response: Response, next: NextFunction) => {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;

  if (!token) {
    response.status(401).json({ error: 'Token de autenticacion requerido' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const userId = typeof payload === 'object' && payload !== null ? payload.sub : undefined;
    const user = userId ? findUserById(Number(userId)) : undefined;

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