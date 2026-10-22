import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { runVerification, getVerifications, listApis } from '../controllers/verification.controller';

const router = Router();

router.use(authenticate, authorize('OFFICER', 'ADMIN'));

router.get('/apis', listApis);
router.get('/', getVerifications);
router.post('/run', runVerification);

export default router;
