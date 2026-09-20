import type { Request, Response } from 'express';

import { findUserById, updateUser } from '../services/user.service.js';

export const getById = (request: Request, response: Response) => {
  const userId = Number(request.params.id);
  const user = findUserById(userId);

  if (!user) {
    response.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  if (request.authenticatedUser?.id !== user.id) {
    response.status(403).json({ error: 'No tiene permisos para consultar este usuario' });
    return;
  }

  const { passwordHash: _passwordHash, ...publicUser } = user;
  response.json(publicUser);
};

export const update = (request: Request, response: Response) => {
  const userId = Number(request.params.id);
  const user = findUserById(userId);

  if (!user) {
    response.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  if (request.authenticatedUser?.id !== user.id) {
    response.status(403).json({ error: 'No tiene permisos para modificar este usuario' });
    return;
  }

  const { username, telefono, domicilio } = request.body ?? {};
  const fields = { username, telefono, domicilio };

  if (Object.values(fields).some((value) => value !== undefined && typeof value !== 'string')) {
    response.status(400).json({ error: 'Los campos deben ser texto' });
    return;
  }

  response.json(updateUser(user, fields));
};