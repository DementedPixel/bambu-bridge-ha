/**
 * Bambu Lab Camera Snapshot via TLS.
 * Adapted from the reference implementation at:
 * C:\Users\bwals\.mcp\bambu-mcp\src\index.ts (lines 324-393)
 *
 * The camera uses a custom binary protocol on TLS port 6000 (NOT HTTP).
 * Auth is an 80-byte packet, then the printer streams JPEG frames.
 * We capture the first valid frame and return it as a Buffer.
 */

import tls from 'tls';
import type { PrinterConfig } from './config.js';

interface CachedSnapshot {
  data: Buffer;
  timestamp: number;
}

const snapshotCache = new Map<string, CachedSnapshot>();
const CACHE_TTL_MS = 2000; // Serve cached snapshot for 2 seconds

/**
 * Capture a JPEG snapshot from the printer camera.
 * Uses a 2-second in-memory cache to avoid hammering the camera
 * when multiple browser tabs are polling.
 */
export async function captureSnapshot(printer: PrinterConfig): Promise<Buffer> {
  const cached = snapshotCache.get(printer.id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const jpegBuffer = await captureRawSnapshot(printer.ip, printer.accessCode);
  snapshotCache.set(printer.id, { data: jpegBuffer, timestamp: Date.now() });
  return jpegBuffer;
}

function captureRawSnapshot(host: string, accessCode: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let done = false;

    const sock = tls.connect(
      { host, port: 6000, rejectUnauthorized: false },
      () => {
        // 80-byte auth packet
        const auth = Buffer.alloc(80, 0);
        auth.writeUInt32LE(0x40, 0);       // header magic
        auth.writeUInt32LE(0x3000, 4);     // header magic
        Buffer.from('bblp', 'ascii').copy(auth, 16);          // username at offset 16
        Buffer.from(accessCode, 'ascii').copy(auth, 48);      // password at offset 48
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
          // Need at least 16 bytes for the frame header
          if (pending.length < 16) break;
          // Payload size in first 3 bytes (little-endian)
          payloadSize = pending[0] | (pending[1] << 8) | (pending[2] << 16);
          frameBuf = Buffer.alloc(0);
          pending = pending.subarray(16);
        } else {
          const needed = payloadSize - frameBuf.length;
          const take = Math.min(needed, pending.length);
          frameBuf = Buffer.concat([frameBuf, pending.subarray(0, take)]);
          pending = pending.subarray(take);

          if (frameBuf.length === payloadSize) {
            // Validate JPEG markers (FFD8 start, FFD9 end)
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
