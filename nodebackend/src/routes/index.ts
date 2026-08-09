import { Router } from 'express';
import authRoutes from './authRoutes';
import guardRoutes from './guardRoutes';
import employerRoutes from './employerRoutes';
import adminRoutes from './adminRoutes';
import salesRoutes from './salesRoutes';
import subadminRoutes from './subadminRoutes';
import sharedRoutes from './sharedRoutes';
import fileRoutes from './fileRoutes';

const router = Router();

// Each portal's routes are mounted here.
router.use(authRoutes);
router.use(guardRoutes); // routes/api/guard.php
router.use(employerRoutes); // routes/api/employer.php
router.use(adminRoutes); // routes/api/admin.php
router.use(salesRoutes); // routes/api/sales.php
router.use(subadminRoutes); // routes/api/subadmin.php
router.use(sharedRoutes); // routes/api/shared.php
router.use(fileRoutes); // signed file downloads

export default router;
