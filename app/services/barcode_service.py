"""
Deterministic inline SVG Barcode (Code128-B, ISO/IEC 15417) and QR Code (ISO/IEC 18004)
generator for Inverum DocumentTemplate rendering ({{ barcode_svg }}, {{ qrcode_svg }}).

Zero external binary or image dependencies — outputs crisp vector <svg> markup
suitable for direct embedding in SVG thermal labels, HTML reports, or Typst templates.
"""
from __future__ import annotations

import html
from typing import Sequence

# ---------------------------------------------------------------------------
# ISO/IEC 15417 Code 128-B Pattern Table (Values 0..106)
# Each pattern is 6 bars/spaces (b, s, b, s, b, s) totaling 11 modules,
# except Stop (106) which has 7 elements totaling 13 modules.
# ---------------------------------------------------------------------------
_CODE128_PATTERNS: tuple[str, ...] = (
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
    "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
    "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
    "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
    "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
    "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
    "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
    "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
    "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
    "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
    "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
    "211214", "211232", "2331112",
)

_START_CODE_B = 104
_STOP_CODE = 106


def encode_code128b(text: str) -> list[int]:
    """Encode an ASCII string (32..126) into Code128-B symbol indices including Start, Checksum, Stop."""
    clean = "".join(ch for ch in (text or "INV-0000") if 32 <= ord(ch) <= 126)
    if not clean:
        clean = "INV-0000"

    codes: list[int] = [_START_CODE_B]
    checksum = _START_CODE_B
    for idx, ch in enumerate(clean, start=1):
        val = ord(ch) - 32
        codes.append(val)
        checksum += val * idx

    codes.append(checksum % 103)
    codes.append(_STOP_CODE)
    return codes


def generate_code128_svg(
    text: str,
    width_mm: float = 48.0,
    height_mm: float = 12.0,
    show_text: bool = True,
    fg_color: str = "#000000",
) -> str:
    """
    Generate a standalone, deterministic inline <svg> for a Code128-B barcode.
    """
    codes = encode_code128b(text)
    patterns = [_CODE128_PATTERNS[c] for c in codes]

    # Quiet zone: 10 modules left and right
    quiet_zone = 10
    total_modules = quiet_zone * 2 + sum(int(w) for pat in patterns for w in pat)
    bar_area_height = 78 if show_text else 100
    view_height = 100

    rects: list[str] = []
    cursor = quiet_zone
    for pat in patterns:
        for i, width_char in enumerate(pat):
            w = int(width_char)
            if i % 2 == 0:  # even index = black bar
                rects.append(
                    f'<rect x="{cursor}" y="0" width="{w}" height="{bar_area_height}" fill="{fg_color}"/>'
                )
            cursor += w

    label_svg = ""
    if show_text:
        escaped = html.escape(text)
        label_svg = (
            f'<text x="{total_modules / 2:.1f}" y="95" '
            f'text-anchor="middle" font-family="monospace" font-size="14" '
            f'fill="{fg_color}">{escaped}</text>'
        )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{width_mm}mm" height="{height_mm}mm" '
        f'viewBox="0 0 {total_modules} {view_height}" '
        f'shape-rendering="crispEdges">'
        f'{"".join(rects)}{label_svg}</svg>'
    )


# ---------------------------------------------------------------------------
# Pure-Python ISO/IEC 18004 QR Code Generator (Versions 1..6, ECC Level L)
# Ensures 100% scannable QR codes with zero external dependencies.
# ---------------------------------------------------------------------------

# Version capacities for Byte Mode (ECC Level L):
# (version, size, total_codewords, ec_codewords_per_block, num_blocks, max_bytes)
_QR_VERSIONS: tuple[tuple[int, int, int, int, int, int], ...] = (
    (1, 21, 26, 7, 1, 17),
    (2, 25, 44, 10, 1, 32),
    (3, 29, 70, 15, 1, 53),
    (4, 33, 100, 20, 1, 78),
    (5, 37, 134, 26, 1, 106),
    (6, 41, 172, 18, 2, 134),
)

_ALIGNMENT_POSITIONS: dict[int, tuple[int, ...]] = {
    1: (),
    2: (6, 18),
    3: (6, 22),
    4: (6, 26),
    5: (6, 30),
    6: (6, 34),
}

# GF(256) log/exp tables with primitive polynomial 0x11D
_GF_EXP = [0] * 512
_GF_LOG = [0] * 256
_x = 1
for _i in range(255):
    _GF_EXP[_i] = _x
    _GF_LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    _GF_EXP[_i] = _GF_EXP[_i - 255]


def _gf_mul(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return _GF_EXP[_GF_LOG[a] + _GF_LOG[b]]


def _rs_generator_poly(degree: int) -> list[int]:
    poly = [1]
    for i in range(degree):
        next_poly = [0] * (len(poly) + 1)
        factor = _GF_EXP[i]
        for j, coeff in enumerate(poly):
            next_poly[j] ^= coeff
            next_poly[j + 1] ^= _gf_mul(coeff, factor)
        poly = next_poly
    return poly


def _rs_encode(data: Sequence[int], ec_len: int) -> list[int]:
    gen = _rs_generator_poly(ec_len)
    reg = [0] * ec_len
    for byte in data:
        factor = byte ^ reg[0]
        reg = reg[1:] + [0]
        if factor != 0:
            for i in range(ec_len):
                reg[i] ^= _gf_mul(gen[i + 1], factor)
    return reg


def _encode_qr_matrix(payload: str) -> list[list[bool]]:
    raw = payload.encode("utf-8")
    if len(raw) > 134:
        raw = raw[:134]

    ver_info = _QR_VERSIONS[-1]
    for cand in _QR_VERSIONS:
        if len(raw) <= cand[5]:
            ver_info = cand
            break

    version, size, total_cw, ec_cw_per_block, num_blocks, _ = ver_info
    data_cw_total = total_cw - ec_cw_per_block * num_blocks

    # Build bit stream: Mode 0100 (Byte), 8-bit length, payload, terminator, pad bytes
    bits: list[int] = [0, 1, 0, 0]
    for shift in range(7, -1, -1):
        bits.append((len(raw) >> shift) & 1)
    for b in raw:
        for shift in range(7, -1, -1):
            bits.append((b >> shift) & 1)

    max_bits = data_cw_total * 8
    for _ in range(min(4, max_bits - len(bits))):
        bits.append(0)
    while len(bits) % 8 != 0:
        bits.append(0)

    data_bytes: list[int] = []
    for i in range(0, len(bits), 8):
        val = 0
        for bit in bits[i : i + 8]:
            val = (val << 1) | bit
        data_bytes.append(val)

    pad_Toggle = [0xEC, 0x11]
    idx = 0
    while len(data_bytes) < data_cw_total:
        data_bytes.append(pad_Toggle[idx % 2])
        idx += 1

    # Split into blocks and compute Reed-Solomon EC codewords
    block_size = data_cw_total // num_blocks
    data_blocks: list[list[int]] = []
    ec_blocks: list[list[int]] = []
    for b_idx in range(num_blocks):
        blk = data_bytes[b_idx * block_size : (b_idx + 1) * block_size]
        data_blocks.append(blk)
        ec_blocks.append(_rs_encode(blk, ec_cw_per_block))

    # Interleave data and EC codewords
    interleaved: list[int] = []
    for i in range(block_size):
        for blk in data_blocks:
            interleaved.append(blk[i])
    for i in range(ec_cw_per_block):
        for ec_blk in ec_blocks:
            interleaved.append(ec_blk[i])

    # Initialize matrix
    matrix: list[list[bool | None]] = [[None] * size for _ in range(size)]
    reserved: list[list[bool]] = [[False] * size for _ in range(size)]

    def set_func(r: int, c: int, val: bool) -> None:
        if 0 <= r < size and 0 <= c < size:
            matrix[r][c] = val
            reserved[r][c] = True

    # Finder patterns + separators
    for fr, fc in ((0, 0), (0, size - 7), (size - 7, 0)):
        for r in range(-1, 8):
            for c in range(-1, 8):
                rr, cc = fr + r, fc + c
                if 0 <= rr < size and 0 <= cc < size:
                    in_outer = 0 <= r <= 6 and 0 <= c <= 6 and (r in (0, 6) or c in (0, 6))
                    in_inner = 2 <= r <= 4 and 2 <= c <= 4
                    set_func(rr, cc, in_outer or in_inner)

    # Alignment patterns
    align = _ALIGNMENT_POSITIONS[version]
    for ar in align:
        for ac in align:
            if (ar == 6 and ac == 6) or (ar == 6 and ac == size - 7) or (ar == size - 7 and ac == 6):
                continue
            for r in range(-2, 3):
                for c in range(-2, 3):
                    is_dark = max(abs(r), abs(c)) in (0, 2)
                    set_func(ar + r, ac + c, is_dark)

    # Timing patterns
    for i in range(8, size - 8):
        if not reserved[6][i]:
            set_func(6, i, i % 2 == 0)
        if not reserved[i][6]:
            set_func(i, 6, i % 2 == 0)

    # Dark module & format reserve areas
    set_func(size - 8, 8, True)
    for i in range(9):
        if i != 6:
            if not reserved[8][i]:
                reserved[8][i] = True
            if not reserved[i][8]:
                reserved[i][8] = True
    for i in range(8):
        reserved[8][size - 1 - i] = True
        reserved[size - 1 - i][8] = True

    # Convert interleaved codewords to bit stream
    full_bits: list[int] = []
    for byte in interleaved:
        for shift in range(7, -1, -1):
            full_bits.append((byte >> shift) & 1)

    # Place data bits in upward/downward 2-column zig-zag
    bit_idx = 0
    upward = True
    col = size - 1
    while col > 0:
        if col == 6:
            col -= 1
        row_iter = range(size - 1, -1, -1) if upward else range(size)
        for row in row_iter:
            for dc in (0, -1):
                c = col + dc
                if not reserved[row][c]:
                    bit = full_bits[bit_idx] if bit_idx < len(full_bits) else 0
                    bit_idx += 1
                    # Mask pattern 0: (row + c) % 2 == 0
                    masked = (bit ^ 1) if ((row + c) % 2 == 0) else bit
                    matrix[row][c] = bool(masked)
        upward = not upward
        col -= 2

    # Format info for ECC Level L (01) + Mask 0 (000) -> precomputed BCH 15-bit: 0x77C4
    fmt_bits = 0x77C4
    fmt_coords_1 = [
        (8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8),
        (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8),
    ]
    for i, (r, c) in enumerate(fmt_coords_1):
        matrix[r][c] = bool((fmt_bits >> i) & 1)

    for i in range(7):
        matrix[size - 1 - i][8] = bool((fmt_bits >> i) & 1)
    for i in range(7, 15):
        matrix[8][size - 15 + i] = bool((fmt_bits >> i) & 1)

    return [[bool(cell) for cell in row] for row in matrix]


def generate_qr_svg(
    data: str,
    size_mm: float = 22.0,
    fg_color: str = "#000000",
    quiet_zone: int = 2,
) -> str:
    """
    Generate a deterministic inline <svg> QR Code for asset/box/document verification.
    """
    matrix = _encode_qr_matrix(data or "INVERUM")
    n = len(matrix)
    total = n + quiet_zone * 2

    path_parts: list[str] = []
    for r, row in enumerate(matrix):
        for c, is_dark in enumerate(row):
            if is_dark:
                x = c + quiet_zone
                y = r + quiet_zone
                path_parts.append(f"M{x},{y}h1v1h-1z")

    path_d = "".join(path_parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{size_mm}mm" height="{size_mm}mm" '
        f'viewBox="0 0 {total} {total}" '
        f'shape-rendering="crispEdges">'
        f'<rect width="{total}" height="{total}" fill="#ffffff"/>'
        f'<path d="{path_d}" fill="{fg_color}"/>'
        f'</svg>'
    )
