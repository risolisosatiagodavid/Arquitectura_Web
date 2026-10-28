import { Router } from 'express';

import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { create, getById, list, remove, update } from '../controllers/store.controller.js';
import { createForStore, listForStore } from '../controllers/product.controller.js';

const router = Router();

router.get('/', list);
router.get('/:id', optionalAuth, getById);
router.get('/:id/productos', optionalAuth, listForStore);
router.post('/', requireAuth, create);
router.post('/:id/productos', requireAuth, createForStore);
router.patch('/:id', requireAuth, update);
router.delete('/:id', requireAuth, remove);

export default router;