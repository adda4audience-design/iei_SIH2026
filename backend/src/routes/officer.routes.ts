import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getDashboard,
  getApplications,
  getApplication,
  assignApplication,
  makeDecision,
  getProfile,
  getValidationReport,
  getChecklist,
} from '../controllers/officer.controller';

const router = Router();

router.use(authenticate, authorize('OFFICER', 'ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/applications', getApplications);
router.get('/applications/:id', getApplication);
router.get('/applications/:id/validation-report', getValidationReport);
router.patch('/applications/:id/assign', assignApplication);
router.patch('/applications/:id/decision', makeDecision);
router.get('/checklists/:type', getChecklist);
router.get('/profile', getProfile);

export default router;
