"""Génère les icônes PWA (fond #0B1020 + flèches ▲ verte / ▼ rouge)."""
from PIL import Image, ImageDraw

BG = (11, 16, 32, 255)
GREEN = (34, 197, 94, 255)
RED = (239, 68, 68, 255)


def rounded_bg(size, radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=BG)
    return img


def draw_arrows(img):
    size = img.size[0]
    d = ImageDraw.Draw(img)
    u = size / 512.0  # unité
    # Flèche verte vers le haut (gauche)
    cx1 = size * 0.33
    d.polygon(
        [(cx1, 150 * u), (cx1 - 70 * u, 250 * u), (cx1 - 28 * u, 250 * u),
         (cx1 - 28 * u, 360 * u), (cx1 + 28 * u, 360 * u),
         (cx1 + 28 * u, 250 * u), (cx1 + 70 * u, 250 * u)],
        fill=GREEN,
    )
    # Flèche rouge vers le bas (droite)
    cx2 = size * 0.67
    d.polygon(
        [(cx2, 362 * u), (cx2 - 70 * u, 262 * u), (cx2 - 28 * u, 262 * u),
         (cx2 - 28 * u, 152 * u), (cx2 + 28 * u, 152 * u),
         (cx2 + 28 * u, 262 * u), (cx2 + 70 * u, 262 * u)],
        fill=RED,
    )
    return img


def main():
    import os
    out = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
    os.makedirs(out, exist_ok=True)
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("icon-180.png", 180)]:
        draw_arrows(rounded_bg(size)).save(os.path.join(out, name))
        print("ok", name)
    # Maskable : fond plein (sans coins arrondis) + motif centré réduit
    m = Image.new("RGBA", (512, 512), BG)
    small = draw_arrows(Image.new("RGBA", (512, 512), (0, 0, 0, 0))).resize((380, 380))
    m.alpha_composite(small, (66, 66))
    m.save(os.path.join(out, "maskable-512.png"))
    print("ok maskable-512.png")


if __name__ == "__main__":
    main()
