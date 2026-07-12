import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import * as applications from '../controllers/applicationController';
import * as attendance from '../controllers/attendanceController';
import * as documents from '../controllers/guardDocumentController';
import * as aadhaar from '../controllers/guardAadhaarController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// mirrors routes/api/guard.php — all under auth:sanctum + role:guard
router.use('/guard', requireAuth, requireRole('guard'));

router.post('/guard/jobs/:job/apply', asyncHandler(applications.apply));
router.get('/guard/applications', asyncHandler(applications.mine));
router.get('/guard/applications/job-ids', asyncHandler(applications.myAppliedJobIds));

router.get('/guard/attendance', asyncHandler(attendance.guardIndex));
router.post('/guard/attendance/check-in', asyncHandler(attendance.checkIn));
router.patch('/guard/attendance/:record/check-out', asyncHandler(attendance.checkOut));

router.get('/guard/documents', asyncHandler(documents.index));
router.post('/guard/documents', upload.single('file'), asyncHandler(documents.store));

router.get('/guard/aadhaar', asyncHandler(aadhaar.status));
router.post('/guard/aadhaar/verify-instant', asyncHandler(aadhaar.instantVerify));
router.post('/guard/aadhaar/send-otp', asyncHandler(aadhaar.sendOtp));
router.post('/guard/aadhaar/verify-otp', asyncHandler(aadhaar.verifyOtp));

export default router;
