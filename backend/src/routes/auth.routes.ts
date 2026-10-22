import { Router } from 'express';
import {
  login,
  loginValidation,
  registerInstitute,
  registerInstituteValidation,
  getMe,
  logout,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/login
router.post('/login', loginValidation, login);

// POST /api/auth/register/institute
router.post('/register/institute', registerInstituteValidation, registerInstitute);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

// POST /api/auth/logout
router.post('/logout', authenticate, logout);

export default router;
