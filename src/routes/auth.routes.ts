import { Router } from 'express';

import { login, logout, register, session } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/registro', register);
router.post('/login', login);
router.get('/sesion', requireAuth, session);
router.post('/logout', logout);

export default router;