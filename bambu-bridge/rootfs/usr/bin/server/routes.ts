import { Router } from 'express';
import { printers, getPrinterConfig } from './config.js';
import { captureSnapshot } from './camera.js';
import type { BambuMQTTClient } from './mqtt.js';

export function createRouter(mqttClients: Map<string, BambuMQTTClient>): Router {
  const router = Router();

  // GET /api/printers — list both printers with current status
  router.get('/printers', (_req, res) => {
    const result = printers.map((p) => {
      const client = mqttClients.get(p.id);
      return {
        id: p.id,
        name: p.name,
        connected: client?.isConnected() ?? false,
        status: client?.getCachedStatus() ?? {},
      };
    });
    res.json(result);
  });

  // GET /api/printers/:id/status — full cached status for one printer
  router.get('/printers/:id/status', (req, res) => {
    const config = getPrinterConfig(req.params.id);
    if (!config) {
      res.status(404).json({ error: 'Printer not found' });
      return;
    }
    const client = mqttClients.get(config.id);
    if (!client) {
      res.status(503).json({ error: 'MQTT client not initialized' });
      return;
    }
    res.json({
      id: config.id,
      name: config.name,
      connected: client.isConnected(),
      status: client.getCachedStatus(),
    });
  });

  // GET /api/printers/:id/snapshot — camera JPEG
  router.get('/printers/:id/snapshot', async (req, res) => {
    const config = getPrinterConfig(req.params.id);
    if (!config) {
      res.status(404).json({ error: 'Printer not found' });
      return;
    }
    try {
      const jpeg = await captureSnapshot(config);
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'no-cache');
      res.send(jpeg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[${config.id}] Snapshot error:`, message);
      res.status(502).json({ error: 'Failed to capture snapshot', detail: message });
    }
  });

  return router;
}
