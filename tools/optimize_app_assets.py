#!/usr/bin/env python3
"""Generate compact WebP copies of MINHAJ's student-app artwork for Flutter builds.

Source PNGs are preserved in Git. The generated directory is ignored by Git and
created by local developers or CI before running pub get/build.
"""
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = REPO_ROOT / "apps" / "minhaj_flutter" / "assets"
OUTPUT_DIR = ASSET_DIR / "optimized"
MAX_DIMENSION = 768
WEBP_QUALITY = 86

IMAGE_NAMES = (
    "branch_scientific.png",
    "branch_literary.png",
    "branch_industrial.png",
    "minhaj-logo.png",
    "subject_arabic.png",
    "subject_math.png",
    "subject_physics.png",
    "subject_chemistry.png",
    "subject_biology.png",
    "subject_english.png",
    "subject_geography.png",
    "subject_history.png",
    "subject_islamic_education.png",
    "subject_technology.png",
    "subject_vocational.png",
)


def main() -> None:
    missing = [name for name in IMAGE_NAMES if not (ASSET_DIR / name).is_file()]
    if missing:
        raise SystemExit(
            "Cannot optimize MINHAJ assets; missing source image(s): "
            + ", ".join(missing)
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    original_total = 0
    optimized_total = 0

    for name in IMAGE_NAMES:
        source = ASSET_DIR / name
        target = OUTPUT_DIR / f"{Path(name).stem}.webp"
        with Image.open(source) as original:
            original_total += source.stat().st_size
            image = original.copy()
            image.thumbnail(
                (MAX_DIMENSION, MAX_DIMENSION),
                Image.Resampling.LANCZOS,
            )
            has_alpha = "A" in image.getbands() or "transparency" in original.info
            image = image.convert("RGBA" if has_alpha else "RGB")
            image.save(
                target,
                format="WEBP",
                quality=WEBP_QUALITY,
                method=6,
            )
        optimized_total += target.stat().st_size
        print(
            f"{name}: {source.stat().st_size:,} -> "
            f"{target.stat().st_size:,} bytes"
        )

    saved = original_total - optimized_total
    percent = (saved / original_total * 100) if original_total else 0
    print(
        f"Generated {len(IMAGE_NAMES)} WebP images: "
        f"{original_total:,} -> {optimized_total:,} bytes "
        f"({percent:.1f}% smaller source set)"
    )


if __name__ == "__main__":
    main()
