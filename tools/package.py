from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARCHIVE = DIST / "TurboTube-Chrome-1.0.0.zip"
PACKAGE_FILES = (
    "manifest.json",
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
        required = {
            "manifest.json",
            "content.js",
            "popup.html",
            "icons/icon-v2-16.png",
            "icons/icon-v2-32.png",
            "icons/icon-v2-48.png",
            "icons/icon-v2-128.png",
        }
        missing = required - entries
        if missing:
            raise RuntimeError(f"Fichiers absents du ZIP : {sorted(missing)}")
        if any("\\" in entry for entry in entries):
            raise RuntimeError("Le ZIP contient des chemins Windows non portables")

    print(f"Archive créée : {ARCHIVE}")


if __name__ == "__main__":
    main()
