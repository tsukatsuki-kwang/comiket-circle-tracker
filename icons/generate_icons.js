/**
 * Comiket Circle Tracker Sync - PNG Icon Generator
 * Generates crisp 16x16, 48x48, and 128x128 PNG icons using pure Node.js.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function generatePNG(width, height) {
  // Create raw RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);

  // Gradient background: Dark Indigo (#1e1e2e) to Electric Purple (#6c5ce7) with a gold Comiket icon accent (#fdcb6e)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const nx = x / width;
      const ny = y / height;

      // Distance from center
      const cx = nx - 0.5;
      const cy = ny - 0.5;
      const dist = Math.sqrt(cx * cx + cy * cy);

      // Outer rounded square background
      const cornerRadius = 0.22;
      const dx = Math.max(Math.abs(cx) - (0.5 - cornerRadius), 0);
      const dy = Math.max(Math.abs(cy) - (0.5 - cornerRadius), 0);
      const isInside = Math.sqrt(dx * dx + dy * dy) <= cornerRadius;

      if (!isInside) {
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0; // Transparent outside rounded box
        continue;
      }

      // Background color: Gradient (#0f172a to #3b82f6)
      let r = Math.round(15 + nx * 30 + ny * 20);
      let g = Math.round(23 + nx * 50 + ny * 60);
      let b = Math.round(42 + nx * 200 + ny * 100);

      // Icon symbol: Star/Circle target in center
      if (dist < 0.28) {
        // Gold target circle (#f59e0b)
        r = 245;
        g = 158;
        b = 11;
      }
      if (dist < 0.16) {
        // Inner white badge center
        r = 255;
        g = 255;
        b = 255;
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255; // Full opacity
    }
  }

  // Build IDAT uncompressed chunk lines
  const lineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * lineLength);
  for (let y = 0; y < height; y++) {
    rawData[y * lineLength] = 0; // Filter type 0 (None)
    buffer.copy(rawData, y * lineLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(rawData);

  // Helper chunk writer
  function writeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);

    // CRC32 calculation
    const crc = calcCRC(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // Table for CRC32
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }

  function calcCRC(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // Header: Signature + IHDR + IDAT + IEND
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = writeChunk('IHDR', ihdrData);
  const idatChunk = writeChunk('IDAT', compressedData);
  const iendChunk = writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname);
[16, 48, 128].forEach((size) => {
  const pngBuffer = generatePNG(size, size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, pngBuffer);
  console.log(`Generated: icon-${size}.png (${pngBuffer.length} bytes)`);
});
