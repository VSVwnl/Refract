"""Create dist/refract.zip with forward-slash entry names.

Python's zipfile is used rather than PowerShell's Compress-Archive, which can
write backslash entry names that break relative paths on other systems.

Usage: python tools/make_zip.py
"""

import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(DIST, "refract.zip")

ENTRIES = [
    ("index.html", "index.html"),
    (os.path.join("vendor", "three.min.js"), "vendor/three.min.js"),
    (os.path.join("vendor", "LICENSE-three.txt"), "vendor/LICENSE-three.txt"),
]


def main():
    os.makedirs(DIST, exist_ok=True)
    missing = [src for src, _ in ENTRIES if not os.path.isfile(os.path.join(ROOT, src))]
    if missing:
        print("FAIL: missing files: " + ", ".join(missing))
        return 1

    if os.path.exists(OUT):
        os.remove(OUT)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for src, name in ENTRIES:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(os.path.join(ROOT, src), "rb") as f:
                z.writestr(info, f.read())

    with zipfile.ZipFile(OUT) as z:
        names = z.namelist()
        bad = z.testzip()
        if bad:
            print("FAIL: corrupt entry " + bad)
            return 1
        if any("\\" in n for n in names):
            print("FAIL: backslash in an entry name: " + str(names))
            return 1
        expected = [name for _, name in ENTRIES]
        if names != expected:
            print("FAIL: zip contents " + str(names) + " expected " + str(expected))
            return 1
        for n in names:
            print("  %-26s %8d bytes" % (n, z.getinfo(n).file_size))

    size = os.path.getsize(OUT)
    print("dist/refract.zip  %d bytes (%.2f MB), limit 35 MB" % (size, size / 1048576.0))
    if size > 35 * 1024 * 1024:
        print("FAIL: over the size limit")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
