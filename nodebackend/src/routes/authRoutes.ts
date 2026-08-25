import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import * as auth from '../controllers/authController';

const router = Router();

// mirrors routes/api/auth.php
router.post('/auth/register/employer', asyncHandler(auth.registerEmployer));
router.post('/auth/register/guard', asyncHandler(auth.registerGuard));
router.post('/auth/login', asyncHandler(auth.login));
router.post('/auth/login/verify-otp', asyncHandler(auth.loginVerifyOtp));
router.post('/auth/logout', asyncHandler(auth.logout));
router.get('/auth/me', requireAuth, asyncHandler(auth.me));
router.post('/auth/email/verification-notification', asyncHandler(auth.resendVerification));
router.post('/auth/email/verify-otp', asyncHandler(auth.verifyEmailOtp));
router.post('/auth/email/resend-otp', asyncHandler(auth.resendEmailOtp));
router.post('/auth/password/request-otp', asyncHandler(auth.requestPasswordOtp));
router.post('/auth/password/reset', asyncHandler(auth.resetPassword));
router.post('/auth/test-email', asyncHandler(auth.testEmail));

// Signed verification link (top-level in auth routes, outside /auth).
router.get('/email/verify/:id/:hash', asyncHandler(auth.verifyEmail));

export default router;
