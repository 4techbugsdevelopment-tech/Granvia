import { Router } from 'express';
import * as agreement from '../controllers/associateAgreementController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { simpleRateLimit } from '../middleware/simpleRateLimit';
import { asyncHandler } from '../utils/http';

const router = Router();

router.post('/esign/callback', simpleRateLimit({ windowMs: 60_000, max: 120, key: (req) => `esign-callback:${req.ip}` }), asyncHandler(agreement.callback));

router.use('/guard/agreement', requireAuth, requireRole('guard'));
router.get('/guard/agreement', asyncHandler(agreement.show));
router.post('/guard/agreement/generate', asyncHandler(agreement.generate));
router.post('/guard/agreement/consent', asyncHandler(agreement.consent));
router.post('/guard/agreement/esign/initiate', simpleRateLimit({ windowMs: 60_000, max: 10, key: (req) => `esign-initiate:${req.user!.id}` }), asyncHandler(agreement.initiate));
router.post('/guard/agreement/esign/sandbox-complete', asyncHandler(agreement.sandboxComplete));
router.get('/guard/agreement/esign/status', asyncHandler(agreement.show));
router.get('/guard/agreement/download', asyncHandler(agreement.download));

export default router;
