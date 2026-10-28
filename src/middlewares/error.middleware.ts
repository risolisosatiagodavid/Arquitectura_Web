import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const isBodyParserError = (error: unknown, type: string): boolean =>
  typeof error === 'object'
  && error !== null
  && 'type' in error
  && error.type === type;

export const notFound = (_request: Request, _response: Response, next: NextFunction) => {
  next(new HttpError(404, 'Recurso no encontrado'));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (isBodyParserError(error, 'entity.parse.failed')) {
    response.status(400).json({ error: 'JSON inválido' });
    return;
  }

  if (isBodyParserError(error, 'entity.too.large')) {
    response.status(413).json({ error: 'El cuerpo de la solicitud es demasiado grande' });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error('Unhandled API error', error);
  response.status(500).json({ error: 'Error interno del servidor' });
};
