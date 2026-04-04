import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';
import { recordHttpMetrics } from '../metrics';

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = randomUUID();
  const startNs = process.hrtime.bigint();

  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;

    recordHttpMetrics(req.method, route, res.statusCode, durationMs);
    logger.info({
      request_id: requestId,
      event: 'http_request',
      method: req.method,
      path: req.path,
      route,
      status_code: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
    });
  });

  next();
};
