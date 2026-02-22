/**
 * Bambu Lab MQTT Client for the web dashboard.
 * Adapted from the reference implementation at:
 * C:\Users\bwals\.mcp\bambu-mcp\src\mqtt-client.ts
 *
 * Phase 1: read-only — connects, subscribes, caches status, emits events.
 */

import mqtt from 'mqtt';
import { EventEmitter } from 'events';
import type { PrinterConfig } from './config.js';
import { broker } from './config.js';

export interface PrinterStatus {
  gcode_state?: string;
  print_type?: string;
  mc_percent?: number;
  mc_remaining_time?: number;
  layer_num?: number;
  total_layer_num?: number;
  subtask_name?: string;

  nozzle_temper?: number;
  nozzle_target_temper?: number;
  bed_temper?: number;
  bed_target_temper?: number;
  chamber_temper?: number;

  big_fan1_speed?: string;
  big_fan2_speed?: string;
  cooling_fan_speed?: string;
  heatbreak_fan_speed?: string;

  spd_lvl?: number;
  spd_mag?: number;

  ams?: {
    ams?: Array<{
      id: string;
      humidity: string;
      temp: string;
      tray?: Array<{
        id: string;
        tray_color?: string;
        tray_type?: string;
        remain?: number;
      }>;
    }>;
    ams_exist_bits?: string;
    tray_now?: string;
  };

  lights_report?: Array<{
    node: string;
    mode: string;
  }>;

  print_error?: number;
  hw_switch_state?: number;
  wifi_signal?: string;

  ipcam?: {
    ipcam_record?: string;
    timelapse?: string;
    resolution?: string;
  };

  [key: string]: unknown;
}

export class BambuMQTTClient extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private config: PrinterConfig;
  private connected: boolean = false;
  private lastStatus: PrinterStatus = {};
  private lastStatusTime: number = 0;
  private lastPushAllTime: number = 0;

  constructor(config: PrinterConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    // Clean up any previous client
    if (this.client) {
      try { this.client.end(true); } catch { /* ignore */ }
      this.client = null;
      this.connected = false;
    }

    const useBroker = !!broker.host;

    return new Promise((resolve, reject) => {
      let settled = false;

      const options: mqtt.IClientOptions = useBroker
        ? {
            host: broker.host,
            port: broker.port,
            protocol: broker.protocol,
            username: broker.username,
            password: broker.password,
            reconnectPeriod: 0,
            connectTimeout: 10000,
          }
        : {
            host: this.config.ip,
            port: this.config.mqttPort,
            protocol: 'mqtts',
            username: 'bblp',
            password: this.config.accessCode,
            rejectUnauthorized: false,
            reconnectPeriod: 0,
            connectTimeout: 10000,
          };

      const target = useBroker
        ? `${broker.host}:${broker.port}`
        : `${this.config.ip}:${this.config.mqttPort}`;
      console.log(`[${this.config.id}] Connecting to ${useBroker ? 'broker' : 'printer'} at ${target}`);

      this.client = mqtt.connect(options);

      this.client.on('connect', () => {
        if (settled) return;
        settled = true;
        this.connected = true;

        // Enable auto-reconnect now that initial connect succeeded
        this.client!.options.reconnectPeriod = 5000;

        const reportTopic = `device/${this.config.serial}/report`;
        this.client!.subscribe(reportTopic, (err) => {
          if (err) {
            console.error(`[${this.config.id}] Failed to subscribe to ${reportTopic}:`, err);
            reject(err);
          } else {
            console.log(`[${this.config.id}] Subscribed to ${reportTopic}`);
            // Request initial full state
            this.requestPushAll();
            resolve();
          }
        });
      });

      // Cache incoming status reports and emit for WebSocket broadcast
      this.client.on('message', (_topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          const status = data.print || data.mc_print;
          if (status) {
            this.lastStatus = { ...this.lastStatus, ...status };
            this.lastStatusTime = Date.now();
            this.emit('status', this.config.id, this.lastStatus);
          }
        } catch {
          // Ignore parse errors on status messages
        }
      });

      this.client.on('error', (err) => {
        console.error(`[${this.config.id}] MQTT error:`, err.message);
        if (!settled) {
          settled = true;
          try { this.client?.end(true); } catch { /* ignore */ }
          this.client = null;
          reject(this.enhanceConnectionError(err));
        }
      });

      this.client.on('close', () => {
        const wasConnected = this.connected;
        this.connected = false;
        if (wasConnected) {
          this.emit('disconnected', this.config.id);
        }
        if (!settled) {
          settled = true;
          try { this.client?.end(true); } catch { /* ignore */ }
          this.client = null;
          reject(this.enhanceConnectionError(
            new Error('Connection closed before MQTT handshake completed')
          ));
        }
      });

      this.client.on('reconnect', () => {
        console.log(`[${this.config.id}] MQTT reconnecting...`);
        this.emit('reconnecting', this.config.id);
      });
    });
  }

  requestPushAll(): void {
    const now = Date.now();
    if (now - this.lastPushAllTime < 5 * 60 * 1000) {
      console.log(`[${this.config.id}] pushall rate-limited, skipping`);
      return;
    }
    if (!this.client || !this.connected) return;

    const topic = `device/${this.config.serial}/request`;
    const message = {
      pushing: {
        sequence_id: '0',
        command: 'pushall',
      },
    };
    this.client.publish(topic, JSON.stringify(message));
    this.lastPushAllTime = now;
    console.log(`[${this.config.id}] Sent pushall`);
  }

  getCachedStatus(): PrinterStatus & { _cached_at: string | null; _age_seconds: number | null } {
    return {
      ...this.lastStatus,
      _cached_at: this.lastStatusTime
        ? new Date(this.lastStatusTime).toISOString()
        : null,
      _age_seconds: this.lastStatusTime
        ? Math.round((Date.now() - this.lastStatusTime) / 1000)
        : null,
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.connected = false;
      this.lastStatus = {};
    }
  }

  private enhanceConnectionError(err: Error): Error {
    const msg = err.message || '';
    if (msg.includes('ECONNRESET') || msg.includes('connack timeout')) {
      return new Error(
        `${msg}. Bambu printers allow only one MQTT client — ` +
        'close BambuStudio, OrcaSlicer, Home Assistant, or MCP servers and retry.'
      );
    }
    return err;
  }
}
