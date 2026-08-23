import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import apiRoutes from './routes';
import { errorHandler, notFound } from './middleware/error';
import { PUBLIC_ROOT } from './utils/fileStorage';
import { startAttendanceAutoCheckout } from './services/attendanceAutoCheckout';

const app = express();

app.use(
  cors({
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public uploads (company logos, avatars) served statically; private files
// go through the signed /api/files/download route instead.
app.use('/storage', express.static(PUBLIC_ROOT));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'granvia-nodebackend' });
});

// All API routes live under /api.
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Granvia Node backend listening on http://127.0.0.1:${env.port}/api`);
  startAttendanceAutoCheckout();
});
