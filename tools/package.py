from json import loads
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
VERSION = loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
ARCHIVE = DIST / f"TurboTube-Chrome-{VERSION}.zip"
PACKAGE_FILES = (
    "manifest.json",
    "shared.js",
    "content.css",
    "content.js",
    "popup.css",
    "popup.html",
    "popup.js",
)


def package_paths() -> list[Path]:
    paths = [ROOT / filename for filename in PACKAGE_FILES]
    paths.extend(ROOT / f"icons/icon-v2-{size}.png" for size in (16, 32, 48, 128))
    return paths


def main() -> None:
    DIST.mkdir(exist_ok=True)
    with ZipFile(ARCHIVE, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in package_paths():
            if not path.is_file():
                raise FileNotFoundError(path)
            archive.write(path, path.relative_to(ROOT).as_posix())

    with ZipFile(ARCHIVE) as archive:
        entries = set(archive.namelist())
        expected = {path.relative_to(ROOT).as_posix() for path in package_paths()}
        if entries != expected:
            raise RuntimeError(f"Contenu ZIP incorrect : {sorted(entries ^ expected)}")

    print(f"Archive créée : {ARCHIVE}")


if __name__ == "__main__":
    main()
