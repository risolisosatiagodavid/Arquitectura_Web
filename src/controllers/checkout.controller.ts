import type { Request, Response } from 'express';

import { completeCheckout, type CheckoutItem } from '../services/checkout.service.js';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseItems = (value: unknown): CheckoutItem[] | undefined => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    return undefined;
  }

  const items: CheckoutItem[] = [];
  const productIds = new Set<number>();
  for (const item of value) {
    if (typeof item !== 'object' || item === null
      || !('productId' in item) || !('quantity' in item)
      || !Number.isSafeInteger(item.productId) || item.productId <= 0
      || !Number.isSafeInteger(item.quantity) || item.quantity <= 0
      || productIds.has(item.productId)) {
      return undefined;
    }

    productIds.add(item.productId);
    items.push({ productId: item.productId, quantity: item.quantity });
  }

  return items;
};

export const checkout = async (request: Request, response: Response) => {
  const { nombre, apellido, direccion, codigoPostal, items } = request.body ?? {};
  const checkoutItems = parseItems(items);

  if (!isNonEmptyString(nombre) || !isNonEmptyString(apellido)
    || !isNonEmptyString(direccion) || !isNonEmptyString(codigoPostal) || !checkoutItems) {
    response.status(400).json({
      error: 'Completá nombre, apellido, dirección, código postal y al menos un producto válido',
    });
    return;
  }

  await completeCheckout(request.authenticatedUser!.id, checkoutItems);
  response.json({ message: 'Compra realizada correctamente' });
};
