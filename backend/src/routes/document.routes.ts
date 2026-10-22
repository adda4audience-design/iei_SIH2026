import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import {
  uploadDocument,
  getDocument,
  deleteDocument,
  runForensicAnalysis,
  getDocumentIntelligence,
} from '../controllers/document.controller';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/:id', getDocument);
router.get('/:id/intelligence', getDocumentIntelligence);
router.delete('/:id', deleteDocument);
router.post('/:id/forensics', authorize('OFFICER', 'ADMIN'), runForensicAnalysis);

export default router;
