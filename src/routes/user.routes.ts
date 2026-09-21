import { Router } from 'express';

import { getById, update } from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/:id', getById);
router.patch('/:id', update);

export default router;