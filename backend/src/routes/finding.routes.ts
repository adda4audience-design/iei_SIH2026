import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getFindings, dismissFinding, addFinding, addNote } from '../controllers/finding.controller';

const router = Router();

router.use(authenticate, authorize('OFFICER', 'ADMIN'));

router.get('/', getFindings);
router.post('/', addFinding);
router.patch('/:id/dismiss', dismissFinding);
router.patch('/:id/note', addNote);

export default router;
