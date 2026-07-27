from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "icons" / "sources" / "turbotube-icon-v2-transparent.png"
ICON_DIR = ROOT / "icons"
TARGET_OCCUPANCY = 0.78


def padded_square(image: Image.Image) -> Image.Image:
    alpha_box = image.getchannel("A").getbbox()
    if alpha_box is None:
        raise ValueError("L’image source est entièrement transparente")

    left, top, right, bottom = alpha_box
    subject_size = max(right - left, bottom - top)
    side = round(subject_size / TARGET_OCCUPANCY)
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    crop_left = round(center_x - side / 2)
    crop_top = round(center_y - side / 2)
    return image.crop((crop_left, crop_top, crop_left + side, crop_top + side))


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    square = padded_square(source)

    for size in (16, 32, 48, 128):
        icon = square.resize((size, size), Image.Resampling.LANCZOS)
        output = ICON_DIR / f"icon-v2-{size}.png"
        icon.save(output, optimize=True)

        alpha = icon.getchannel("A")
        if alpha.getpixel((0, 0)) != 0 or alpha.getbbox() is None:
            raise ValueError(f"Transparence invalide pour {output.name}")


if __name__ == "__main__":
    main()
