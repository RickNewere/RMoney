"""Genera le icone di RMoney (icon.png, adaptive-icon.png, splash.png)."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
os.makedirs(OUT, exist_ok=True)

S = 1024
TOP = (59, 130, 246)     # #3b82f6
BOT = (29, 58, 138)      # #1e3a8a


def find_font(size, bold=True):
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\seguisb.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def gradient(w, h, top, bot):
    base = Image.new("RGB", (w, h), top)
    px = base.load()
    for y in range(h):
        f = y / (h - 1)
        r = int(top[0] + (bot[0] - top[0]) * f)
        g = int(top[1] + (bot[1] - top[1]) * f)
        b = int(top[2] + (bot[2] - top[2]) * f)
        for x in range(w):
            px[x, y] = (r, g, b)
    return base


def draw_mark(img, cx, cy, scale=1.0, coin=True):
    d = ImageDraw.Draw(img)
    if coin:
        rad = int(300 * scale)
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad],
                  fill=(255, 255, 255, 28))
    # Testo "RM"
    fr = find_font(int(360 * scale))
    d.text((cx, cy - int(70 * scale)), "RM", font=fr, fill="white",
           anchor="mm")
    # Simbolo € (badge verde in basso a destra)
    fe = find_font(int(210 * scale))
    bx, by = cx + int(215 * scale), cy + int(215 * scale)
    er = int(135 * scale)
    d.ellipse([bx - er, by - er, bx + er, by + er], fill=(34, 197, 94, 255))
    d.text((bx, by - int(6 * scale)), "€", font=fe, fill="white",
           anchor="mm")


# 1) icon.png  (full bleed)
icon = gradient(S, S, TOP, BOT).convert("RGBA")
draw_mark(icon, S // 2, S // 2, scale=1.0, coin=False)
icon.convert("RGB").save(os.path.join(OUT, "icon.png"))

# 2) adaptive-icon.png (Android foreground: contenuto centrato, sfondo trasparente)
adap = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw_mark(adap, S // 2, S // 2, scale=0.72, coin=False)
adap.save(os.path.join(OUT, "adaptive-icon.png"))

# 3) splash.png (marchio su sfondo trasparente, blu dallo splash config)
splash = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw_mark(splash, S // 2, S // 2, scale=0.9, coin=False)
splash.save(os.path.join(OUT, "splash.png"))

# 4) favicon.png (piccolo, per eventuale web)
icon.resize((196, 196)).convert("RGB").save(os.path.join(OUT, "favicon.png"))

print("Icone create in", OUT)
for f in os.listdir(OUT):
    print(" -", f)
