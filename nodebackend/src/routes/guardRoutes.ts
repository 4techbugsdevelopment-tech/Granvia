import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { requireAadhaarApi } from '../middleware/aadhaarApi';
import * as applications from '../controllers/applicationController';
import * as attendance from '../controllers/attendanceController';
import * as documents from '../controllers/guardDocumentController';
import * as aadhaar from '../controllers/guardAadhaarController';
import * as surepassTest from '../controllers/surepassTestController';
import * as availability from '../controllers/availabilityController';
import * as wallet from '../controllers/walletController';
import * as withdrawal from '../controllers/withdrawalController';
import * as offer from '../controllers/jobOfferController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// mirrors routes/api/guard.php — all under auth:sanctum + role:guard
router.use('/guard', requireAuth, requireRole('guard'));

router.post('/guard/jobs/:job/apply', asyncHandler(applications.apply));
router.get('/guard/applications', asyncHandler(applications.mine));
router.get('/guard/applications/job-ids', asyncHandler(applications.myAppliedJobIds));
router.get('/guard/job-offers', asyncHandler(offer.guardIndex));
router.patch('/guard/job-offers/:jobOffer', asyncHandler(offer.guardUpdate));

router.get('/guard/availability', asyncHandler(availability.index));
router.post('/guard/availability', asyncHandler(availability.store));
router.patch('/guard/availability/:availability', asyncHandler(availability.update));
router.delete('/guard/availability/:availability', asyncHandler(availability.destroy));

router.get('/guard/wallet', asyncHandler(wallet.guardShow));
router.get('/guard/wallet/transactions', asyncHandler(wallet.guardTransactions));
router.get('/guard/withdrawals', asyncHandler(withdrawal.mine));
router.post('/guard/withdrawals', asyncHandler(withdrawal.requestWithdrawal));

router.get('/guard/attendance', asyncHandler(attendance.guardIndex));
router.post('/guard/attendance/check-in', asyncHandler(attendance.checkIn));
router.post('/guard/attendance/history', asyncHandler(attendance.saveHistorical));
router.patch('/guard/attendance/:record/check-out', asyncHandler(attendance.checkOut));

router.get('/guard/documents', asyncHandler(documents.index));
router.post('/guard/documents', upload.single('file'), asyncHandler(documents.store));

router.get('/guard/aadhaar', asyncHandler(aadhaar.status));
// Automated/self-service verification — gated off until the real Aadhaar API is live.
router.post('/guard/aadhaar/mock-session', requireAadhaarApi, asyncHandler(surepassTest.createMockSession));
router.post('/guard/aadhaar/verify-instant', requireAadhaarApi, asyncHandler(aadhaar.instantVerify));
router.post('/guard/aadhaar/send-otp', requireAadhaarApi, asyncHandler(aadhaar.sendOtp));
router.post('/guard/aadhaar/verify-otp', requireAadhaarApi, asyncHandler(aadhaar.verifyOtp));

export default router;
