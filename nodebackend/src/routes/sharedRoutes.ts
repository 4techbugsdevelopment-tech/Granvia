import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/http';
import { requireAuth } from '../middleware/auth';
import * as job from '../controllers/jobController';
import * as profile from '../controllers/profileController';
import * as notification from '../controllers/notificationController';
import * as support from '../controllers/supportTicketController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

// mirrors routes/api/shared.php

// Public.
router.get('/jobs', asyncHandler(job.active));

// Any authenticated role, under /me.
router.use('/me', requireAuth);

router.get('/me/profile', asyncHandler(profile.show));
router.patch('/me/profile', asyncHandler(profile.update));
router.post('/me/avatar', upload.single('file'), asyncHandler(profile.uploadAvatar));
router.get('/me/employer-profile', asyncHandler(profile.showEmployerProfile));
router.patch('/me/employer-profile', asyncHandler(profile.updateEmployerProfile));
router.get('/me/guard-profile', asyncHandler(profile.showGuardProfile));
router.patch('/me/guard-profile', asyncHandler(profile.updateGuardProfile));

router.get('/me/notifications', asyncHandler(notification.index));
router.patch('/me/notifications/:notification/read', asyncHandler(notification.markRead));

router.get('/me/support-tickets', asyncHandler(support.index));
router.post('/me/support-tickets', asyncHandler(support.store));

export default router;
