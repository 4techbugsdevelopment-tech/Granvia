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
import * as associateTypes from '../controllers/associateTypeController';
import * as locationMaster from '../controllers/locationMasterController';
import * as associateAgreement from '../controllers/adminAssociateAgreementController';
import * as internalStaff from '../controllers/internalStaffController';
import * as application from '../controllers/applicationController';
import * as wallet from '../controllers/walletController';
import * as attendance from '../controllers/attendanceController';

const router = Router();

// mirrors routes/api/admin.php — all under auth:sanctum + role:super_admin
router.use('/admin', requireAuth, requireRole('super_admin'));

router.get('/admin/guards', asyncHandler(adminGuard.index));
router.post('/admin/guards', asyncHandler(adminGuard.store));
router.patch('/admin/guards/:guard', asyncHandler(adminGuard.update));
router.post('/admin/guards/:guard/password-reset', asyncHandler(adminGuard.resetPassword));
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
router.patch('/admin/attendance/:record/status', asyncHandler(attendance.adminUpdateStatus));
router.get('/admin/hiring', asyncHandler(adminReport.hiring));
router.get('/admin/email-logs', asyncHandler(emailLog.index));
router.get('/admin/wallets', asyncHandler(wallet.adminIndex));

router.get('/admin/roles', asyncHandler(roles.index));
router.post('/admin/roles', asyncHandler(roles.store));
router.patch('/admin/roles/:role', asyncHandler(roles.update));
router.delete('/admin/roles/:role', asyncHandler(roles.destroy));
router.get('/admin/associate-types', asyncHandler(associateTypes.index));
router.post('/admin/associate-types', asyncHandler(associateTypes.store));
router.patch('/admin/associate-types/:associateType', asyncHandler(associateTypes.update));
router.delete('/admin/associate-types/:associateType', asyncHandler(associateTypes.destroy));
router.get('/admin/location/states', asyncHandler(locationMaster.adminStates));
router.post('/admin/location/states', asyncHandler(locationMaster.storeState));
router.patch('/admin/location/states/:state', asyncHandler(locationMaster.updateState));
router.delete('/admin/location/states/:state', asyncHandler(locationMaster.destroyState));
router.get('/admin/location/cities', asyncHandler(locationMaster.adminCities));
router.post('/admin/location/cities', asyncHandler(locationMaster.storeCity));
router.patch('/admin/location/cities/:city', asyncHandler(locationMaster.updateCity));
router.delete('/admin/location/cities/:city', asyncHandler(locationMaster.destroyCity));
router.get('/admin/internal-staff', asyncHandler(internalStaff.adminIndex));
router.post('/admin/internal-staff', asyncHandler(internalStaff.adminStore));

router.get('/admin/jobs/pending', asyncHandler(job.pending));
router.get('/admin/jobs', asyncHandler(job.all));
router.post('/admin/jobs', asyncHandler(job.adminStore));
router.patch('/admin/jobs/:job', asyncHandler(job.adminUpdate));
router.patch('/admin/jobs/:job/approve', asyncHandler(job.approve));
router.patch('/admin/jobs/:job/reject', asyncHandler(job.reject));
router.patch('/admin/jobs/:job/status', asyncHandler(job.adminUpdateStatus));
router.delete('/admin/jobs/:job', asyncHandler(job.destroy));
router.get('/admin/jobs/:job/applications', asyncHandler(application.adminJobApplications));
router.patch('/admin/applications/:application/status', asyncHandler(application.adminUpdateStatus));
router.post('/admin/applications/:application/schedule-interview', asyncHandler(application.scheduleInterview));

router.get('/admin/employers', asyncHandler(adminEmployer.index));
router.patch('/admin/company-documents/:document', asyncHandler(adminEmployer.updateCompanyDocumentStatus));
router.post('/admin/employers', asyncHandler(adminEmployer.store));
router.patch('/admin/employers/:employer', asyncHandler(adminEmployer.update));
router.post('/admin/employers/:employer/password-reset', asyncHandler(adminEmployer.resetPassword));
router.post('/admin/employers/:employer/wallet-credit', asyncHandler(wallet.adminGrantCredit));
router.patch('/admin/employers/:employer/aadhaar', asyncHandler(aadhaarManual.adminDeclareEmployer));
router.delete('/admin/employers/:employer', asyncHandler(adminEmployer.destroy));

export default router;
