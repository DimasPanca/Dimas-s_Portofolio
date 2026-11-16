"""One-off portrait matting (PRD §4.7 step 1-2).

Usage: python tools/images/cutout.py design/source/Dimas.jpg tools/images/raw/portrait-cutout.png [model]
Requires: pip install "rembg[cpu]" pillow numpy   (run inside tools/images/.venv, which is git-ignored)
"""
import sys

import numpy as np
from PIL import Image
from rembg import new_session, remove

src, dst = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "birefnet-general-lite"

image = Image.open(src).convert("RGB")
session = new_session(model)
cut = remove(image, session=session, post_process_mask=False)  # RGBA

# Edge decontamination: the backdrop is light grey, so semi-transparent edge pixels carry a pale fringe.
# Pull the colour of those pixels toward the darker interior so the cut-out sits cleanly on near-black.
rgba = np.asarray(cut).astype(np.float32)
rgb, alpha = rgba[..., :3], rgba[..., 3:4] / 255.0
edge = (alpha > 0.02) & (alpha < 0.98)
backdrop = np.array([150.0, 150.0, 146.0], dtype=np.float32)
unmixed = (rgb - backdrop * (1.0 - alpha)) / np.clip(alpha, 0.05, 1.0)
rgb = np.where(edge, np.clip(unmixed, 0, 255), rgb)
out = np.concatenate([rgb, alpha * 255.0], axis=-1).astype(np.uint8)
Image.fromarray(out, "RGBA").save(dst)
print(f"saved {dst} ({cut.size[0]}x{cut.size[1]}) with {model}")
