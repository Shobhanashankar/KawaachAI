import { NextFunction, Request, Response } from 'express';
import { adminApiConfig } from '../config';

export const requireAdminBearer = (req: Request, res: Response, next: NextFunction): void => {
  const expected = `Bearer ${adminApiConfig.adminBearerToken}`;
  if (req.header('authorization') !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
};
