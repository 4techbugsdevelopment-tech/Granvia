import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/http';
import * as operations from '../controllers/operationsController';

const router = Router();
router.use('/operations', requireAuth, requireRole('operations'));
router.get('/operations/dashboard', asyncHandler(operations.dashboard));
router.get('/operations/applications', asyncHandler(operations.applications));
router.patch('/operations/applications/:application/status', asyncHandler(operations.updateApplication));
export default router;
