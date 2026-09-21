import { Router } from 'express';

import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { create, getById, list, remove, update } from '../controllers/store.controller.js';

const router = Router();

router.get('/', list);
router.get('/:id', optionalAuth, getById);
router.post('/', requireAuth, create);
router.patch('/:id', requireAuth, update);
router.delete('/:id', requireAuth, remove);

export default router;