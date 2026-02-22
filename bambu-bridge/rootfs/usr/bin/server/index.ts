import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { printers, BACKEND_PORT } from './config.js';
import { BambuMQTTClient } from './mqtt.js';
import { createRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

const server = http.createServer(app);

// --- WebSocket setup ---
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(data: object): void {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  // Send current state for all printers immediately on connect
  for (const [id, client] of mqttClients) {
    if (client.isConnected()) {
      ws.send(JSON.stringify({
        printer: id,
        status: client.getCachedStatus(),
      }));
    }
  }
  ws.on('close', () => console.log('WebSocket client disconnected'));
});

// --- MQTT clients ---
const mqttClients = new Map<string, BambuMQTTClient>();

async function initMQTT(): Promise<void> {
  for (const printer of printers) {
    if (!printer.serial || !printer.accessCode) {
      console.warn(`[${printer.id}] Missing serial or access code, skipping MQTT`);
      continue;
    }

    const client = new BambuMQTTClient(printer);

    // Forward status updates to WebSocket clients
    client.on('status', (printerId: string, status: object) => {
      broadcast({ printer: printerId, status });
    });

    client.on('disconnected', (printerId: string) => {
      broadcast({ printer: printerId, event: 'disconnected' });
    });

    client.on('reconnecting', (printerId: string) => {
      broadcast({ printer: printerId, event: 'reconnecting' });
    });

    try {
      await client.connect();
      console.log(`[${printer.id}] MQTT connected to ${printer.ip}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[${printer.id}] MQTT connection failed: ${message}`);
      // Client stays in the map — REST endpoints can report disconnected status
    }

    mqttClients.set(printer.id, client);
  }
}

// --- Mount routes ---
app.use('/api', createRouter(mqttClients));

// --- Static file serving (production / Docker) ---
const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// --- Start ---
async function main(): Promise<void> {
  await initMQTT();

  server.listen(BACKEND_PORT, () => {
    console.log(`Backend listening on http://localhost:${BACKEND_PORT}`);
    console.log(`WebSocket available at ws://localhost:${BACKEND_PORT}/ws`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  for (const client of mqttClients.values()) {
    client.disconnect();
  }
  server.close();
  process.exit(0);
});
