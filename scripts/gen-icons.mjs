/**
 * Generates the PWA icon set (icon-192, icon-512, maskable-512, apple-touch)
 * as solid PNGs by writing minimal PNG bytes directly, so the build works
 * without external assets or image tooling.
 *
 * Run: `npm run icons`
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const TEAL = [15, 118, 110] // #0f766e
const WHITE = [255, 255, 255]

// A simple rounded-square + white cross glyph, drawn per-pixel.
function renderIcon(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4)
  const pad = maskable ? Math.round(size * 0.1) : 0
  const radius = Math.round(size * 0.22)

  const inRoundedRect = (x, y) => {
    if (x < pad || y < pad || x >= size - pad || y >= size - pad) return false
    const cx = Math.min(Math.max(x, pad + radius), size - pad - radius - 1)
    const cy = Math.min(Math.max(y, pad + radius), size - pad - radius - 1)
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= radius * radius
  }

  const crossThickness = Math.max(1, Math.round(size * 0.14))
  const arm = Math.round(size * 0.26)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (!inRoundedRect(x, y)) {
        px[i + 3] = 0 // transparent
        continue
      }
      const center = size / 2
      const inH =
        Math.abs(x - center) <= arm && Math.abs(y - center) <= crossThickness
      const inV =
        Math.abs(y - center) <= arm && Math.abs(x - center) <= crossThickness
      const color = inH || inV ? WHITE : TEAL
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = 255
    }
  }
  return px
}

function pngFor(size, maskable) {
  const raw = renderIcon(size, { maskable })
  const stride = size * 4 + 1
  const scanlines = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(stride)
    raw.copy(row, 1, y * size * 4, (y + 1) * size * 4)
    scanlines.push(row)
  }
  const idat = deflateSync(Buffer.concat(scanlines))

  const crcTable = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  const crc32 = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeBuf = Buffer.from(type, 'ascii')
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
    return Buffer.concat([len, typeBuf, data, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
]

for (const [name, size, maskable] of targets) {
  writeFileSync(join(outDir, name), pngFor(size, maskable))
  console.log(`wrote ${name} (${size}x${size})`)
}