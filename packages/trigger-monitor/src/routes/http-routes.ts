import { Express } from 'express';
import { config, getActiveZones } from '@kawaachai/shared';
import { requireAdminBearer } from '../utils/auth';
import { ExclusionService } from '../services/exclusions';
import { TriggerPoller } from '../services/poller';

interface RouteDeps {
  exclusionService: ExclusionService;
  poller: TriggerPoller;
}

const resolveZone = async (zoneH3?: string): Promise<string> => {
  if (zoneH3) return zoneH3;
  const zones = await getActiveZones();
  if (!zones.length) {
    throw new Error('No active zones configured');
  }
  return zones[0].h3_index;
};

export const registerHttpRoutes = (app: Express, deps: RouteDeps): void => {
  app.get('/health', async (_req, res) => {
    res.json({ status: 'ok', service: 'trigger-monitor' });
  });

  app.get('/admin/exclusions', requireAdminBearer, async (_req, res, next) => {
    try {
      const state = await deps.exclusionService.getState();
      res.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/admin/exclusions', requireAdminBearer, async (req, res, next) => {
    try {
      const state = await deps.exclusionService.update({
        war: typeof req.body?.war === 'boolean' ? req.body.war : undefined,
        pandemic_WHO_declared:
          typeof req.body?.pandemic_WHO_declared === 'boolean'
            ? req.body.pandemic_WHO_declared
            : undefined,
        government_force_majeure:
          typeof req.body?.government_force_majeure === 'boolean'
            ? req.body.government_force_majeure
            : undefined,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
        set_by: req.header('x-admin-user') ?? 'admin',
      });

      res.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.post('/webhooks/curfew', requireAdminBearer, async (req, res, next) => {
    try {
      const exclusion = await deps.exclusionService.check();
      if (exclusion.active) {
        res.status(409).json({ message: `exclusion active: ${exclusion.activeKey}` });
        return;
      }

      const zoneH3 = await resolveZone(req.body?.zone_h3);
      const event = await deps.poller.publishWebhookEvent(zoneH3, 'CURFEW');
      res.status(202).json({ event_id: event.event_id, trigger_type: event.trigger_type });
    } catch (error) {
      next(error);
    }
  });

  app.post('/webhooks/platform-downtime', requireAdminBearer, async (req, res, next) => {
    try {
      const exclusion = await deps.exclusionService.check();
      if (exclusion.active) {
        res.status(409).json({ message: `exclusion active: ${exclusion.activeKey}` });
        return;
      }

      const downtimeHours = Number(req.body?.downtime_hours ?? 0);
      if (downtimeHours < config.thresholds.platformDowntimeHours) {
        res.status(202).json({ message: 'Downtime below threshold, no event published' });
        return;
      }

      const zoneH3 = await resolveZone(req.body?.zone_h3);
      const event = await deps.poller.publishWebhookEvent(zoneH3, 'PLATFORM_DOWN');
      res.status(202).json({ event_id: event.event_id, trigger_type: event.trigger_type });
    } catch (error) {
      next(error);
    }
  });
};
