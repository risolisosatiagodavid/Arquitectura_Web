import { Router } from 'express';

import { getById, remove, update } from '../controllers/product.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/:id', optionalAuth, getById);
router.patch('/:id', requireAuth, update);
router.delete('/:id', requireAuth, remove);

export default router;
