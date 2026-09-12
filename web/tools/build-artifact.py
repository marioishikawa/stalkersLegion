#!/usr/bin/env python3
"""
Strips web/index.html into the fragment the Claude Artifact publisher expects.

The publisher wraps the page it is given in its own <!doctype>/<head>/<body>,
so the hosted copy must not carry those tags - but the repo copy does, because
it has to open by double-clicking it. This produces one from the other.

Usage: python3 web/tools/build-artifact.py [output.html]
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
source = (ROOT / "index.html").read_text()

# Drop the document wrapper and the meta tags the publisher supplies itself.
for pattern in (
    r"<!doctype html>\s*", r"</?html[^>]*>\s*", r"</?head>\s*", r"</?body>\s*",
    r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*',
):
    source = re.sub(pattern, "", source, flags=re.I)

out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "artifact.html"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(source.strip() + "\n")
print("wrote " + str(out))
