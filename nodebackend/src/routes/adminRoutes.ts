import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import * as adminGuard from '../controllers/adminGuardController';
import * as adminEmployer from '../controllers/adminEmployerController';
import * as guardDoc from '../controllers/guardDocumentController';
import * as job from '../controllers/jobController';
import * as report from '../controllers/reportController';
import * as adminReport from '../controllers/adminReportController';
import * as aadhaarManual from '../controllers/aadhaarManualController';
import * as emailLog from '../controllers/emailLogController';
import * as roles from '../controllers/roleController';
import * as associateAgreement from '../controllers/adminAssociateAgreementController';

const router = Router();

// mirrors routes/api/admin.php — all under auth:sanctum + role:super_admin
router.use('/admin', requireAuth, requireRole('super_admin'));

router.get('/admin/guards', asyncHandler(adminGuard.index));
router.post('/admin/guards', asyncHandler(adminGuard.store));
router.patch('/admin/guards/:guard', asyncHandler(adminGuard.update));
router.delete('/admin/guards/:guard', asyncHandler(adminGuard.destroy));
router.patch('/admin/guards/:guard/aadhaar', asyncHandler(aadhaarManual.adminDeclareGuard));
router.get('/admin/guards/:guard/documents', asyncHandler(guardDoc.adminIndex));
router.patch('/admin/guard-documents/:document', asyncHandler(guardDoc.adminUpdateStatus));
router.get('/admin/guards/:guard/agreement', asyncHandler(associateAgreement.show));
router.get('/admin/guards/:guard/agreement/:agreement/download', asyncHandler(associateAgreement.download));
router.post('/admin/guards/:guard/agreement/:agreement/supersede', asyncHandler(associateAgreement.supersede));

router.get('/admin/reports/counts', asyncHandler(report.adminCounts));
router.get('/admin/reports/analytics', asyncHandler(adminReport.analytics));
router.get('/admin/attendance', asyncHandler(adminReport.attendance));
router.get('/admin/hiring', asyncHandler(adminReport.hiring));
router.get('/admin/email-logs', asyncHandler(emailLog.index));

router.get('/admin/roles', asyncHandler(roles.index));
router.post('/admin/roles', asyncHandler(roles.store));
router.patch('/admin/roles/:role', asyncHandler(roles.update));
router.delete('/admin/roles/:role', asyncHandler(roles.destroy));

router.get('/admin/jobs/pending', asyncHandler(job.pending));
router.get('/admin/jobs', asyncHandler(job.all));
router.post('/admin/jobs', asyncHandler(job.adminStore));
router.patch('/admin/jobs/:job', asyncHandler(job.adminUpdate));
router.patch('/admin/jobs/:job/approve', asyncHandler(job.approve));
router.patch('/admin/jobs/:job/reject', asyncHandler(job.reject));
router.patch('/admin/jobs/:job/status', asyncHandler(job.adminUpdateStatus));
router.delete('/admin/jobs/:job', asyncHandler(job.destroy));

router.get('/admin/employers', asyncHandler(adminEmployer.index));
router.post('/admin/employers', asyncHandler(adminEmployer.store));
router.patch('/admin/employers/:employer', asyncHandler(adminEmployer.update));
router.patch('/admin/employers/:employer/aadhaar', asyncHandler(aadhaarManual.adminDeclareEmployer));
router.delete('/admin/employers/:employer', asyncHandler(adminEmployer.destroy));

export default router;
