#!/usr/bin/env python3
"""Chroma-key #00FF00 greenscreen sprites → transparent PNGs."""
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image

def key_green(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    result = Image.new("RGBA", image.size)
    pixels = []
    for r, g, b, a in image.getdata():
        if g > 155 and r < 110 and b < 110 and g > r * 1.75 and g > b * 1.75:
            dominance = g - max(r, b)
            alpha = int(max(0, min(255, (190 - dominance) * 255 / 55)))
            if alpha < 255:
                opacity = alpha / 255.0
                if opacity > 0:
                    r = min(255, round(r / opacity))
                    g = min(255, round(max(0, g - 255 * (1 - opacity)) / opacity))
                    b = min(255, round(b / opacity))
                else:
                    r = g = b = 0
                a = min(a, alpha)
            else:
                a = 0
                r = g = b = 0
        pixels.append((r, g, b, a))
    result.putdata(pixels)
    return result

def process(src: Path, dst: Path, height: int = 280) -> None:
    image = key_green(Image.open(src))
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError(f"No opaque pixels in {src}")
    image = image.crop(bbox)
    scale = height / image.height
    image = image.resize((max(1, round(image.width * scale)), height), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    image.save(dst, optimize=True)
    print(f"{dst.name}: {image.width}x{image.height}")

def split_turnaround(src: Path, dest_dir: Path, sprite_id: str, height: int = 280, flat: bool = True) -> None:
    sheet = Image.open(src).convert("RGBA")
    # key whole sheet first
    sheet = key_green(sheet)
    w, h = sheet.size
    views = ["front", "side", "back", "left"]
    for i, view in enumerate(views):
        panel = sheet.crop((i * w // 4, 0, (i + 1) * w // 4, h))
        bbox = panel.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"No pixels {sprite_id} {view}")
        panel = panel.crop(bbox)
        nw = max(1, round(panel.width * height / panel.height))
        panel = panel.resize((nw, height), Image.Resampling.LANCZOS)
        if flat:
            out = dest_dir / f"{sprite_id}_{view}.png"
            panel.save(out, optimize=True)
        sub = dest_dir / sprite_id
        sub.mkdir(parents=True, exist_ok=True)
        panel.save(sub / f"{view}.png", optimize=True)
        print(f"{sprite_id}/{view}: {panel.width}x{panel.height}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--height", type=int, default=280)
    ap.add_argument("--split", action="store_true")
    ap.add_argument("--id", default="")
    args = ap.parse_args()
    src, dst = Path(args.src), Path(args.dst)
    if args.split:
        split_turnaround(src, dst, args.id or src.stem.replace("-turnaround","").replace("_","-").replace("-","_"))
    else:
        process(src, dst, args.height)
