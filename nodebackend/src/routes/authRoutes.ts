import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import * as auth from '../controllers/authController';

const router = Router();

// mirrors routes/api/auth.php
router.post('/auth/register/employer', asyncHandler(auth.registerEmployer));
router.post('/auth/register/guard', asyncHandler(auth.registerGuard));
router.post('/auth/login', asyncHandler(auth.login));
router.post('/auth/logout', requireAuth, asyncHandler(auth.logout));
router.get('/auth/me', requireAuth, asyncHandler(auth.me));
router.post('/auth/email/verification-notification', asyncHandler(auth.resendVerification));

// Signed verification link (top-level in Laravel's auth.php, outside /auth).
router.get('/email/verify/:id/:hash', asyncHandler(auth.verifyEmail));

export default router;
