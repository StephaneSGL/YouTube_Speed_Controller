from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "icons"
CANVAS_SIZE = 1024


def rounded_rectangle(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def render_master() -> Image.Image:
    image = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Chrome recommande 16 px de marge autour d’un pictogramme de 96 px à l’échelle 128 px.
    padding = 128
    rounded_rectangle(draw, (padding, padding, 896, 896), 176, "#7CF7D4")

    bar_width = 92
    gap = 58
    bottom = 746
    heights = (210, 350, 490)
    start_x = 288
    for index, height in enumerate(heights):
        left = start_x + index * (bar_width + gap)
        rounded_rectangle(draw, (left, bottom - height, left + bar_width, bottom), 46, "#07110E")

    return image


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    master = render_master()
    for size in (16, 32, 48, 128):
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(ICON_DIR / f"icon-{size}.png", optimize=True)


if __name__ == "__main__":
    main()
