#!/usr/bin/env python3
"""Pack the original Discola card bitmaps into one RGBA PNG sprite sheet per deck.

Reads the 8-bit Windows BMPs from briscola-JS and lays them out on an 11x4 grid:
columns 0..9 are card numbers 1..10, rows 0..3 are the suits in the Pascal
TSeme order (Denari, Coppe, Spade, Bastoni); column 10 row 0 holds the card back.
Cards inside a deck are not all the same size, so every cell is the deck's
maximum and each card is centred in it over transparent padding.
"""
import json
import os
import struct
import sys
import zlib

SUITS = ["o", "c", "s", "b"]  # Denari, Coppe, Spade, Bastoni
DECKS = ["Trevisane", "Romagnole", "Napoletane", "Piacentine", "Francesi"]


def read_bmp(path):
    """Return (width, height, rows) for an 8-bit palettised BMP, top row first."""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:2] != b"BM":
        raise ValueError(f"{path}: not a BMP")
    pixel_offset = struct.unpack_from("<I", data, 10)[0]
    header_size = struct.unpack_from("<I", data, 14)[0]
    width, height = struct.unpack_from("<ii", data, 18)
    bpp = struct.unpack_from("<H", data, 28)[0]
    compression = struct.unpack_from("<I", data, 30)[0]
    if bpp != 8 or compression != 0:
        raise ValueError(f"{path}: expected uncompressed 8-bit, got {bpp}bpp/{compression}")

    palette_start = 14 + header_size
    palette = []
    for i in range(256):
        b, g, r, _ = data[palette_start + i * 4: palette_start + i * 4 + 4]
        palette.append((r, g, b))

    bottom_up = height > 0
    height = abs(height)
    stride = (width + 3) & ~3  # BMP rows are padded to 4 bytes

    rows = []
    for y in range(height):
        src = y if not bottom_up else height - 1 - y
        start = pixel_offset + src * stride
        line = data[start: start + width]
        rows.append([palette[idx] for idx in line])
    return width, height, rows


def write_png(path, width, height, pixels):
    """Write an RGBA PNG with adaptive per-row filtering."""

    def chunk(tag, payload):
        body = tag + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = bytearray()
    prev = bytearray(width * 4)
    for y in range(height):
        line = bytearray()
        for px in pixels[y]:
            line += bytes(px)
        best, best_score = None, None
        for ftype in range(5):
            out = bytearray(len(line))
            for i in range(len(line)):
                a = line[i - 4] if i >= 4 else 0
                b = prev[i]
                c = prev[i - 4] if i >= 4 else 0
                x = line[i]
                if ftype == 0:
                    out[i] = x
                elif ftype == 1:
                    out[i] = (x - a) & 0xFF
                elif ftype == 2:
                    out[i] = (x - b) & 0xFF
                elif ftype == 3:
                    out[i] = (x - ((a + b) >> 1)) & 0xFF
                else:
                    p = a + b - c
                    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                    pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                    out[i] = (x - pred) & 0xFF
            score = sum(v if v < 128 else 256 - v for v in out)
            if best_score is None or score < best_score:
                best_score, best = score, (ftype, out)
        raw.append(best[0])
        raw += best[1]
        prev = line

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


def pack_deck(src_dir, out_path):
    names = [(f"{n}{s}.bmp", n - 1, si) for si, s in enumerate(SUITS) for n in range(1, 11)]
    names.append(("dorso.bmp", 10, 0))

    loaded = {}
    for fname, col, row in names:
        loaded[(col, row)] = read_bmp(os.path.join(src_dir, fname))

    cell_w = max(v[0] for v in loaded.values())
    cell_h = max(v[1] for v in loaded.values())
    sheet_w, sheet_h = cell_w * 11, cell_h * 4

    blank = (0, 0, 0, 0)
    sheet = [[blank] * sheet_w for _ in range(sheet_h)]
    for (col, row), (w, h, rows) in loaded.items():
        ox = col * cell_w + (cell_w - w) // 2
        oy = row * cell_h + (cell_h - h) // 2
        for y in range(h):
            dst = sheet[oy + y]
            for x in range(w):
                r, g, b = rows[y][x]
                dst[ox + x] = (r, g, b, 255)

    size = write_png(out_path, sheet_w, sheet_h, sheet)
    return {"cell": [cell_w, cell_h], "sheet": [sheet_w, sheet_h], "bytes": size}


def main():
    src_root, out_root = sys.argv[1], sys.argv[2]
    os.makedirs(out_root, exist_ok=True)
    meta = {}
    for deck in DECKS:
        info = pack_deck(os.path.join(src_root, deck), os.path.join(out_root, f"{deck.lower()}.png"))
        meta[deck] = info
        print(f"{deck:12} cell {info['cell'][0]}x{info['cell'][1]}  "
              f"sheet {info['sheet'][0]}x{info['sheet'][1]}  {info['bytes'] / 1024:.0f} KB")
    with open(os.path.join(out_root, "decks.json"), "w") as fh:
        json.dump(meta, fh, indent=2)


if __name__ == "__main__":
    main()
