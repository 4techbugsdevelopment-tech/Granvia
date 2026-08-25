import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import * as sales from '../controllers/salesController';

const router = Router();

// mirrors routes/api/sales.php — auth:sanctum + role:sales_executive
router.use('/sales', requireAuth, requireRole('sales_executive'));

router.get('/sales/reports/counts', asyncHandler(sales.counts));
router.get('/sales/activity', asyncHandler(sales.activity));

router.get('/sales/clients', asyncHandler(sales.clients));
router.get('/sales/clients/:employer', asyncHandler(sales.clientDetail));

router.get('/sales/jobs', asyncHandler(sales.jobs));
router.post('/sales/jobs/request-otp', asyncHandler(sales.requestJobOtp));
router.post('/sales/jobs', asyncHandler(sales.storeJob));

router.get('/sales/discounts', asyncHandler(sales.discounts));
router.post('/sales/discounts', asyncHandler(sales.storeDiscount));
router.patch('/sales/discounts/:discount', asyncHandler(sales.updateDiscount));
router.delete('/sales/discounts/:discount', asyncHandler(sales.destroyDiscount));

router.get('/sales/manpower', asyncHandler(sales.manpower));

export default router;
