/**
 * Camera snapshot capture for Bambu Lab printers.
 *
 * Ported from server/camera.ts — standalone, no server imports.
 * Custom binary protocol on TLS port 6000, periodic capture,
 * publishes base64 JPEG to bambu_bridge/{serial}/camera.
 */

import tls from 'tls';
import type { MqttClient } from 'mqtt';

export interface CameraConfig {
  ip: string;
  serial: string;
  accessCode: string;
}

interface CachedSnapshot {
  data: Buffer;
  timestamp: number;
}

const CACHE_TTL_MS = 2000;
const snapshotCache = new Map<string, CachedSnapshot>();
const activeTimers = new Map<string, ReturnType<typeof setInterval>>();

// ---------------------------------------------------------------------------
// Raw snapshot capture (TLS port 6000)
// ---------------------------------------------------------------------------

function captureRawSnapshot(host: string, accessCode: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let done = false;

    const sock = tls.connect(
      { host, port: 6000, rejectUnauthorized: false },
      () => {
        // 80-byte auth packet
        const auth = Buffer.alloc(80, 0);
        auth.writeUInt32LE(0x40, 0);
        auth.writeUInt32LE(0x3000, 4);
        Buffer.from('bblp', 'ascii').copy(auth, 16);
        Buffer.from(accessCode, 'ascii').copy(auth, 48);
        sock.write(auth);
      },
    );

    let pending = Buffer.alloc(0);
    let payloadSize = 0;
    let frameBuf: Buffer | null = null;

    sock.on('data', (chunk) => {
      if (done) return;
      pending = Buffer.concat([pending, chunk]);

      while (pending.length > 0 && !done) {
        if (frameBuf === null) {
          if (pending.length < 16) break;
          payloadSize = pending[0] | (pending[1] << 8) | (pending[2] << 16);
          frameBuf = Buffer.alloc(0);
          pending = pending.subarray(16);
        } else {
          const needed = payloadSize - frameBuf.length;
          const take = Math.min(needed, pending.length);
          frameBuf = Buffer.concat([frameBuf, pending.subarray(0, take)]);
          pending = pending.subarray(take);

          if (frameBuf.length === payloadSize) {
            const validStart = frameBuf[0] === 0xff && frameBuf[1] === 0xd8;
            const validEnd =
              frameBuf[frameBuf.length - 2] === 0xff &&
              frameBuf[frameBuf.length - 1] === 0xd9;

            if (validStart && validEnd) {
              done = true;
              sock.destroy();
              resolve(frameBuf);
              return;
            }
            frameBuf = null; // Bad frame, try next
          }
        }
      }
    });

    sock.on('error', (err) => {
      if (!done) {
        done = true;
        reject(new Error(`Camera stream error: ${err.message}`));
      }
    });

    setTimeout(() => {
      if (!done) {
        done = true;
        sock.destroy();
        reject(new Error('Camera snapshot timed out (10s)'));
      }
    }, 10000);
  });
}

// ---------------------------------------------------------------------------
// Cached capture
// ---------------------------------------------------------------------------

async function captureWithCache(config: CameraConfig): Promise<Buffer> {
  const cached = snapshotCache.get(config.serial);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const jpeg = await captureRawSnapshot(config.ip, config.accessCode);
  snapshotCache.set(config.serial, { data: jpeg, timestamp: Date.now() });
  return jpeg;
}

// ---------------------------------------------------------------------------
// Periodic capture + MQTT publish
// ---------------------------------------------------------------------------

export function startCamera(
  mosqClient: MqttClient,
  config: CameraConfig,
  intervalSeconds: number,
): void {
  // Stop existing timer if any
  stopCamera(config.serial);

  const topic = `bambu_bridge/${config.serial}/camera`;

  const capture = async () => {
    try {
      const jpeg = await captureWithCache(config);
      const b64 = jpeg.toString('base64');
      mosqClient.publish(topic, b64, { qos: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${config.serial}] Camera capture failed: ${msg}`);
    }
  };

  // Initial capture, then periodic
  capture();
  const timer = setInterval(capture, intervalSeconds * 1000);
  activeTimers.set(config.serial, timer);
  console.log(`[${config.serial}] Camera started (every ${intervalSeconds}s)`);
}

export function stopCamera(serial: string): void {
  const timer = activeTimers.get(serial);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(serial);
    snapshotCache.delete(serial);
    console.log(`[${serial}] Camera stopped`);
  }
}

export function stopAllCameras(): void {
  for (const serial of activeTimers.keys()) {
    stopCamera(serial);
  }
}
