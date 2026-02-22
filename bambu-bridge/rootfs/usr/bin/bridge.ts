/**
 * Bambu MQTT Bridge
 *
 * Sole MQTT client per printer. Republishes all messages to a local
 * Mosquitto broker so unlimited clients can subscribe.
 *
 * Printer config is loaded from a JSON file (path via PRINTERS_CONFIG
 * env var, defaults to ../printers.json).
 *
 * For each printer:
 *   - Subscribes to device/{serial}/report on PRINTER → publishes to MOSQUITTO
 *   - Subscribes to device/{serial}/request on MOSQUITTO → forwards to PRINTER
 */

import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  publishDiscovery,
  publishAvailability,
  handleReport,
  subscribeHATopics,
  handleHACommand,
} from './discovery.js';
import { startCamera, stopAllCameras } from './camera.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PrinterConfig {
  name: string;
  ip: string;
  serial: string;
  accessCode: string;
}

function loadPrinters(): PrinterConfig[] {
  const configPath = process.env.PRINTERS_CONFIG
    || path.resolve(__dirname, '..', 'printers.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const entries: PrinterConfig[] = JSON.parse(raw);
    console.log(`Loaded ${entries.length} printer(s) from ${configPath}`);
    return entries;
  } catch (err) {
    console.error(`Failed to load printers config from ${configPath}:`, err);
    return [];
  }
}

const printerConfigs = loadPrinters();
const MOSQUITTO_URL = process.env.MOSQUITTO_URL || 'mqtt://localhost:1883';
const HA_DISCOVERY = (process.env.HA_DISCOVERY || 'true') !== 'false';
const HA_DISCOVERY_PREFIX = process.env.HA_DISCOVERY_PREFIX || 'homeassistant';
const CAMERA_INTERVAL = parseInt(process.env.CAMERA_INTERVAL || '5', 10);

function bridgePrinter(config: PrinterConfig): void {
  const reportTopic = `device/${config.serial}/report`;
  const requestTopic = `device/${config.serial}/request`;

  console.log(`[${config.name}] Starting bridge for ${config.ip} (${config.serial})`);

  // --- Printer-side connection (mqtts, TLS, auth) ---
  const printerClient = mqtt.connect({
    host: config.ip,
    port: 8883,
    protocol: 'mqtts',
    username: 'bblp',
    password: config.accessCode,
    rejectUnauthorized: false,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  // --- Mosquitto-side connection (mqtt, plain, no auth) ---
  const mosqClient = mqtt.connect(MOSQUITTO_URL, {
    clientId: `bridge-${config.serial}-${Date.now()}`,
    reconnectPeriod: 5000,
    connectTimeout: 5000,
    will: HA_DISCOVERY
      ? {
          topic: `bambu_bridge/${config.serial}/status`,
          payload: Buffer.from('offline'),
          retain: true,
          qos: 1,
        }
      : undefined,
  });

  let printerConnected = false;
  let mosqConnected = false;
  let lastPushAllTime = 0;
  let cachedState: Record<string, unknown> = {};

  // --- Printer events ---
  printerClient.on('connect', () => {
    printerConnected = true;
    console.log(`[${config.name}] Connected to printer ${config.ip}`);

    if (HA_DISCOVERY && mosqConnected) {
      publishAvailability(mosqClient, config.serial, 'online');
    }

    printerClient.subscribe(reportTopic, (err) => {
      if (err) {
        console.error(`[${config.name}] Failed to subscribe to ${reportTopic}:`, err);
      } else {
        console.log(`[${config.name}] Subscribed to ${reportTopic} on printer`);
      }
    });

    // Send pushall on connect (rate-limited to 5 min)
    const now = Date.now();
    if (now - lastPushAllTime > 5 * 60 * 1000) {
      const pushallMsg = JSON.stringify({
        pushing: { sequence_id: '0', command: 'pushall' },
      });
      printerClient.publish(requestTopic, pushallMsg);
      lastPushAllTime = now;
      console.log(`[${config.name}] Sent pushall to printer`);
    }
  });

  printerClient.on('message', (topic, payload) => {
    // Forward printer report → Mosquitto
    if (topic === reportTopic && mosqConnected) {
      mosqClient.publish(reportTopic, payload, { qos: 0 });

      if (HA_DISCOVERY) {
        cachedState = handleReport(mosqClient, config.serial, payload, cachedState);
      }
    }
  });

  printerClient.on('error', (err) => {
    console.error(`[${config.name}] Printer MQTT error:`, err.message);
  });

  printerClient.on('close', () => {
    printerConnected = false;
    console.log(`[${config.name}] Printer connection closed, will reconnect...`);

    if (HA_DISCOVERY && mosqConnected) {
      publishAvailability(mosqClient, config.serial, 'offline');
    }
  });

  printerClient.on('reconnect', () => {
    console.log(`[${config.name}] Reconnecting to printer...`);
  });

  // --- Mosquitto events ---
  mosqClient.on('connect', () => {
    mosqConnected = true;
    console.log(`[${config.name}] Connected to Mosquitto`);

    mosqClient.subscribe(requestTopic, (err) => {
      if (err) {
        console.error(`[${config.name}] Failed to subscribe to ${requestTopic}:`, err);
      } else {
        console.log(`[${config.name}] Subscribed to ${requestTopic} on Mosquitto`);
      }
    });

    if (HA_DISCOVERY) {
      publishDiscovery(
        mosqClient,
        { serial: config.serial, name: config.name, ip: config.ip },
        HA_DISCOVERY_PREFIX,
      );

      subscribeHATopics(mosqClient, config.serial, HA_DISCOVERY_PREFIX);

      if (printerConnected) {
        publishAvailability(mosqClient, config.serial, 'online');
      }
    }

    if (CAMERA_INTERVAL > 0) {
      startCamera(
        mosqClient,
        { ip: config.ip, serial: config.serial, accessCode: config.accessCode },
        CAMERA_INTERVAL,
      );
    }
  });

  mosqClient.on('message', (topic, payload) => {
    // Forward Mosquitto request → printer
    if (topic === requestTopic && printerConnected) {
      printerClient.publish(requestTopic, payload, { qos: 0 });
      try {
        const data = JSON.parse(payload.toString());
        const cmd = data.print?.command || data.pushing?.command || data.system?.command || 'unknown';
        console.log(`[${config.name}] request → printer (command: ${cmd})`);
      } catch {
        console.log(`[${config.name}] request → printer (${payload.length} bytes)`);
      }
    }

    // HA command routing
    if (HA_DISCOVERY && topic.startsWith(`bambu_bridge/${config.serial}/command/`)) {
      const cmdPayload = handleHACommand(topic, config.serial, payload);
      if (cmdPayload && printerConnected) {
        printerClient.publish(requestTopic, cmdPayload, { qos: 0 });
        console.log(`[${config.name}] HA command → printer: ${topic.split('/').pop()}`);
      }
    }

    // HA restart re-discovery
    if (HA_DISCOVERY && topic === `${HA_DISCOVERY_PREFIX}/status` && payload.toString() === 'online') {
      console.log(`[${config.name}] HA came online, re-publishing discovery`);
      publishDiscovery(
        mosqClient,
        { serial: config.serial, name: config.name, ip: config.ip },
        HA_DISCOVERY_PREFIX,
      );
    }
  });

  mosqClient.on('error', (err) => {
    console.error(`[${config.name}] Mosquitto error:`, err.message);
  });

  mosqClient.on('close', () => {
    mosqConnected = false;
    console.log(`[${config.name}] Mosquitto connection closed, will reconnect...`);
  });
}

// --- Main ---
function main(): void {
  console.log('Bambu MQTT Bridge starting...');
  console.log(`Mosquitto URL: ${MOSQUITTO_URL}`);

  if (printerConfigs.length === 0) {
    console.error('No printers configured. Check printers.json or PRINTERS_CONFIG env var.');
    process.exit(1);
  }

  for (const config of printerConfigs) {
    if (!config.serial || !config.accessCode) {
      console.warn(`[${config.name}] Missing serial or access code, skipping`);
      continue;
    }
    bridgePrinter(config);
  }
}

main();

function shutdown(): void {
  console.log('Bridge shutting down...');
  stopAllCameras();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
