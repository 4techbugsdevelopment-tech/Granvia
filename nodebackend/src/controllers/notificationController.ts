import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';

// Port of App\Http\Controllers\NotificationController.

/** GET /me/notifications */
export async function index(req: Request, res: Response) {
  const rows = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(snakeKeys(rows));
}

/** PATCH /me/notifications/:notification/read */
export async function markRead(req: Request, res: Response) {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.notification } });
  if (!notification) throw new HttpError(404, 'Not found.');
  if (notification.userId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const updated = await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });
  return res.json(snakeKeys(updated));
}
