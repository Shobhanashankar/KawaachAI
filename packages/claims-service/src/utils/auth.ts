import { NextFunction, Request, Response } from 'express';
import { config } from '@kawaachai/shared';

export const requireAdminBearer = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${config.adminBearerToken}`;

  if (!authHeader || authHeader !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
};
