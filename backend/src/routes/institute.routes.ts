import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getDashboard,
  getMyApplications,
  getApplication,
  createApplication,
  submitApplication,
  getProfile,
} from '../controllers/institute.controller';

const router = Router();

router.use(authenticate, authorize('INSTITUTE'));

router.get('/dashboard', getDashboard);
router.get('/applications', getMyApplications);
router.post('/applications', createApplication);
router.get('/applications/:id', getApplication);
router.patch('/applications/:id/submit', submitApplication);
router.get('/profile', getProfile);

export default router;
