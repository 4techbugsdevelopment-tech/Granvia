import { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma';
import { resolveTokenUserId } from '../utils/token';

// Augment Express Request with the authenticated user + raw token.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Awaited<ReturnType<typeof prisma.user.findUnique>>;
      bearerToken?: string;
    }
  }
}

/** Bearer-token auth guard for protected routes. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  const bearer = match[1].trim();
  const userId = await resolveTokenUserId(bearer);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  req.user = user;
  req.bearerToken = bearer;
  next();
}
