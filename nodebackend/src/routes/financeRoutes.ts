import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { asyncHandler } from '../utils/http';
import * as withdrawal from '../controllers/withdrawalController';

const router = Router();
router.use('/finance', requireAuth, requireRole('finance'));
router.get('/finance/withdrawals', asyncHandler(withdrawal.financeIndex));
router.patch('/finance/withdrawals/:withdrawal/decision', asyncHandler(withdrawal.decide));
router.post('/finance/withdrawals/:withdrawal/complete', asyncHandler(withdrawal.complete));
export default router;
