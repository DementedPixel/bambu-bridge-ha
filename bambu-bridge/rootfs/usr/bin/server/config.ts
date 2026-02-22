import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PrinterConfig {
  id: string;
  name: string;
  ip: string;
  serial: string;
  accessCode: string;
  mqttPort: number;
  cameraPort: number;
}

interface PrinterEntry {
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
    const entries: PrinterEntry[] = JSON.parse(raw);
    return entries.map((entry) => ({
      id: entry.serial,
      name: entry.name,
      ip: entry.ip,
      serial: entry.serial,
      accessCode: entry.accessCode,
      mqttPort: 8883,
      cameraPort: 6000,
    }));
  } catch (err) {
    console.error(`Failed to load printers config from ${configPath}:`, err);
    return [];
  }
}

export const printers: PrinterConfig[] = loadPrinters();

export const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);

export interface BrokerConfig {
  host: string;
  port: number;
  protocol: 'mqtt' | 'mqtts';
  username?: string;
  password?: string;
}

export const broker: BrokerConfig = {
  host: process.env.MQTT_BROKER_HOST || '',
  port: parseInt(process.env.MQTT_BROKER_PORT || '1883', 10),
  protocol: (process.env.MQTT_BROKER_PROTOCOL as 'mqtt' | 'mqtts') || 'mqtt',
  username: process.env.MQTT_BROKER_USER || undefined,
  password: process.env.MQTT_BROKER_PASS || undefined,
};

export function getPrinterConfig(id: string): PrinterConfig | undefined {
  return printers.find(p => p.id === id);
}
