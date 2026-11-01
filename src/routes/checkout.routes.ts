import { Router } from 'express';

import { checkout } from '../controllers/checkout.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', requireAuth, checkout);

export default router;
