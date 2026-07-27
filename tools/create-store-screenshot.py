from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "store-assets"
SOURCE_SCREENSHOT = ASSETS / "popup-source.png"
SOURCE_BACKGROUND = ASSETS / "speed-background-source.png"
OUTPUT_LARGE = ASSETS / "turbotube-store-1280x800.png"
OUTPUT_SMALL = ASSETS / "turbotube-store-640x400.png"


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def build_large() -> Image.Image:
    canvas_size = (1280, 800)
    background = Image.open(SOURCE_BACKGROUND).convert("RGB")
    canvas = ImageOps.fit(background, canvas_size, method=Image.Resampling.LANCZOS).convert("RGBA")

    # Assombrit légèrement le décor pour garder l’interface parfaitement lisible.
    shade = Image.new("RGBA", canvas_size, (0, 0, 0, 42))
    canvas = Image.alpha_composite(canvas, shade)

    screenshot = Image.open(SOURCE_SCREENSHOT).convert("RGBA")
    target_height = 720
    target_width = round(screenshot.width * target_height / screenshot.height)
    screenshot = screenshot.resize((target_width, target_height), Image.Resampling.LANCZOS)
    screenshot.putalpha(rounded_mask(screenshot.size, 24))

    x = (canvas_size[0] - target_width) // 2
    y = (canvas_size[1] - target_height) // 2

    glow = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle(
        (x - 12, y - 12, x + target_width + 12, y + target_height + 12),
        radius=38,
        fill=(124, 247, 212, 68),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(34))
    canvas = Image.alpha_composite(canvas, glow)

    shadow = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x - 8, y + 10, x + target_width + 8, y + target_height + 22),
        radius=34,
        fill=(0, 0, 0, 190),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(screenshot, (x, y))

    border = ImageDraw.Draw(canvas)
    border.rounded_rectangle(
        (x, y, x + target_width - 1, y + target_height - 1),
        radius=24,
        outline=(124, 247, 212, 75),
        width=2,
    )
    return canvas.convert("RGB")


def main() -> None:
    large = build_large()
    large.save(OUTPUT_LARGE, optimize=True)
    large.resize((640, 400), Image.Resampling.LANCZOS).save(OUTPUT_SMALL, optimize=True)

    for path, expected in ((OUTPUT_LARGE, (1280, 800)), (OUTPUT_SMALL, (640, 400))):
        with Image.open(path) as image:
            if image.size != expected:
                raise ValueError(f"Dimensions incorrectes pour {path.name}: {image.size}")
        print(f"Créé : {path} — {expected[0]}x{expected[1]}")


if __name__ == "__main__":
    main()
