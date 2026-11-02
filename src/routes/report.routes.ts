import { Router } from 'express';

import { inventory } from '../controllers/report.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/inventario', requireAuth, inventory);

export default router;
