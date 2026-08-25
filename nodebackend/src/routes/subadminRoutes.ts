import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import * as sub from '../controllers/subAdminController';

const router = Router();

// mirrors routes/api/subadmin.php — auth:sanctum + role:sub_admin
router.use('/subadmin', requireAuth, requireRole('sub_admin'));

router.get('/subadmin/reports/counts', asyncHandler(sub.counts));

router.get('/subadmin/company', asyncHandler(sub.company));
router.patch('/subadmin/company', asyncHandler(sub.updateCompany));

router.get('/subadmin/staff', asyncHandler(sub.staff));
router.post('/subadmin/staff', asyncHandler(sub.storeStaff));
router.patch('/subadmin/staff/:staff', asyncHandler(sub.updateStaff));
router.delete('/subadmin/staff/:staff', asyncHandler(sub.destroyStaff));

router.get('/subadmin/verification', asyncHandler(sub.verificationQueue));
router.patch('/subadmin/guard-documents/:document', asyncHandler(sub.updateDocument));

router.get('/subadmin/clients', asyncHandler(sub.clients));
router.get('/subadmin/guards', asyncHandler(sub.guards));
router.get('/subadmin/attendance', asyncHandler(sub.attendance));

router.get('/subadmin/reports/skills', asyncHandler(sub.skillsReport));
router.get('/subadmin/reports/commission', asyncHandler(sub.commissionReport));

export default router;
