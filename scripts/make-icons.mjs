import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const i = row + 1 + x * 4;
      const cx = x - size / 2 + 0.5;
      const cy = y - size / 2 + 0.5;
      const inside = cx * cx + cy * cy <= (size * 0.46) ** 2;
      if (!inside) {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0;
        continue;
      }
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const rail = (nx > 0.34 && nx < 0.42) || (nx > 0.58 && nx < 0.66);
      const rungs = [0.32, 0.46, 0.6, 0.74].some((ry) => Math.abs(ny - ry) < 0.04);
      const ladder = (rail || (rungs && nx > 0.34 && nx < 0.66)) && ny > 0.24 && ny < 0.84;
      if (ladder) {
        raw[i] = 224;
        raw[i + 1] = 138;
        raw[i + 2] = 60;
      } else {
        raw[i] = 28;
        raw[i + 1] = 25;
        raw[i + 2] = 21;
      }
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.resolve("public/icons");
fs.mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(dir, `icon${size}.png`), png(size));
}
