import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { requireAadhaarApi } from '../middleware/aadhaarApi';
import * as company from '../controllers/companyController';
import * as site from '../controllers/siteController';
import * as companyDoc from '../controllers/companyDocumentController';
import * as job from '../controllers/jobController';
import * as application from '../controllers/applicationController';
import * as attendance from '../controllers/attendanceController';
import * as interview from '../controllers/interviewRequestController';
import * as offer from '../controllers/jobOfferController';
import * as agreement from '../controllers/agreementController';
import * as payment from '../controllers/paymentController';
import * as invoice from '../controllers/invoiceController';
import * as wallet from '../controllers/walletController';
import * as aadhaar from '../controllers/employerAadhaarController';
import * as report from '../controllers/reportController';
import * as aadhaarManual from '../controllers/aadhaarManualController';
import * as team from '../controllers/employerTeamController';
import * as internalStaff from '../controllers/internalStaffController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// mirrors routes/api/employer.php — all under auth:sanctum + role:employer
router.use('/employer', requireAuth, requireRole('employer'));

router.get('/employer/companies', asyncHandler(company.index));
router.post('/employer/companies', asyncHandler(company.store));
router.patch('/employer/companies/:company', asyncHandler(company.update));
router.delete('/employer/companies/:company', asyncHandler(company.destroy));
router.post('/employer/companies/:company/logo', upload.single('file'), asyncHandler(company.uploadLogo));

router.get('/employer/companies/:company/sites', asyncHandler(site.index));
router.post('/employer/sites', asyncHandler(site.store));
router.patch('/employer/sites/:site', asyncHandler(site.update));
router.delete('/employer/sites/:site', asyncHandler(site.destroy));

router.get('/employer/companies/:company/documents', asyncHandler(companyDoc.index));
router.post('/employer/companies/:company/documents', upload.single('file'), asyncHandler(companyDoc.store));
router.patch('/employer/companies/:company/documents/:document', asyncHandler(companyDoc.update));
router.delete('/employer/companies/:company/documents/:document', asyncHandler(companyDoc.destroy));

router.get('/employer/jobs', asyncHandler(job.mine));
router.post('/employer/jobs', asyncHandler(job.store));
router.patch('/employer/jobs/:job', asyncHandler(job.update));
router.delete('/employer/jobs/:job', asyncHandler(job.destroy));

router.get('/employer/applications', asyncHandler(application.employerIndex));
router.patch('/employer/applications/:application/status', asyncHandler(application.updateStatus));

router.get('/employer/staff', asyncHandler(team.listStaff));
router.post('/employer/staff', asyncHandler(team.storeStaff));
router.patch('/employer/staff/:staff', asyncHandler(team.updateStaff));
router.delete('/employer/staff/:staff', asyncHandler(team.destroyStaff));
router.get('/employer/operations-users', asyncHandler(internalStaff.employerIndex));
router.post('/employer/operations-users', asyncHandler(internalStaff.employerStore));

router.get('/employer/subadmins', asyncHandler(team.listSubAdmins));
router.post('/employer/subadmins', asyncHandler(team.storeSubAdmin));
router.patch('/employer/subadmins/:subAdmin', asyncHandler(team.updateSubAdmin));
router.delete('/employer/subadmins/:subAdmin', asyncHandler(team.destroySubAdmin));

router.patch('/employer/associates/:guard/aadhaar', asyncHandler(aadhaarManual.employerDeclareAssociate));

router.get('/employer/attendance', asyncHandler(attendance.employerIndex));
router.patch('/employer/attendance/:record/status', asyncHandler(attendance.updateStatus));

router.get('/employer/interview-requests', asyncHandler(interview.index));
router.post('/employer/interview-requests', asyncHandler(interview.store));
router.patch('/employer/interview-requests/:interviewRequest', asyncHandler(interview.update));

router.get('/employer/job-offers', asyncHandler(offer.index));
router.post('/employer/job-offers', asyncHandler(offer.store));
router.patch('/employer/job-offers/:jobOffer', asyncHandler(offer.update));

router.get('/employer/agreements', asyncHandler(agreement.index));
router.post('/employer/agreements', asyncHandler(agreement.store));
router.patch('/employer/agreements/:agreement', asyncHandler(agreement.update));

router.get('/employer/payments', asyncHandler(payment.index));
router.post('/employer/payments', asyncHandler(payment.store));
router.post('/employer/payments/:payment/request-otp', asyncHandler(payment.requestCashOtp));
router.post('/employer/payments/:payment/confirm-otp', asyncHandler(payment.confirmCashOtp));

router.get('/employer/invoices', asyncHandler(invoice.index));

router.get('/employer/wallet', asyncHandler(wallet.show));
router.get('/employer/wallet/transactions', asyncHandler(wallet.transactions));

router.get('/employer/aadhaar', asyncHandler(aadhaar.status));
// Automated/self-service verification — gated off until the real Aadhaar API is live.
router.post('/employer/aadhaar/verify-instant', requireAadhaarApi, asyncHandler(aadhaar.instantVerify));
router.post('/employer/aadhaar/send-otp', requireAadhaarApi, asyncHandler(aadhaar.sendOtp));
router.post('/employer/aadhaar/verify-otp', requireAadhaarApi, asyncHandler(aadhaar.verifyOtp));

router.get('/employer/reports/counts', asyncHandler(report.counts));

export default router;
