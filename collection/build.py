#!/usr/bin/env python3
"""Build the RHC Collection static catalog from ../../scrimshaw/catalog/items/*.json.
Idempotent — safe to re-run any time the source JSON changes (phase 3 research updates).
Usage: python3 build.py
"""
import json
import html
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
ITEMS_DIR = ROOT.parent.parent / "scrimshaw" / "catalog" / "items"
PHOTOS_SRC = ROOT.parent.parent / "scrimshaw" / "renamed"
PHOTOS_DST = ROOT / "photos"
ITEMS_OUT = ROOT / "items"

FIELD_ORDER = [
    ("object_type", "Object Type"),
    ("material", "Material"),
    ("dimensions_cm", "Dimensions (cm)"),
    ("subject_matter", "Subject Matter"),
    ("inscriptions", "Inscriptions"),
    ("artist_attribution", "Artist Attribution"),
    ("date_or_period", "Date / Period"),
    ("mount_display_stand", "Mount / Display Stand"),
    ("color_technique", "Color / Technique"),
    ("condition_notes", "Condition Notes"),
    ("distinguishing_features", "Distinguishing Features"),
    ("provenance_notes", "Provenance Notes"),
    ("legal_regulatory_status", "Legal / Regulatory Status"),
    ("acquisition_info", "Acquisition Info"),
    ("rights_copyright", "Rights / Copyright"),
    ("keywords", "Keywords"),
    ("related_items", "Related Items"),
    ("status", "Status"),
    ("date_cataloged", "Date Cataloged"),
]

GROUPS = [
    ("Netsuke", lambda it: "netsuke" in (it["object_type"] + " ".join(it.get("keywords", []))).lower()),
    ("Scrimshaw (Engraved Teeth & Tusks)", lambda it: "scrimshaw" in " ".join(it.get("keywords", [])).lower() or "engraved" in it["object_type"].lower()),
    ("Asian Export Carvings", lambda it: any(k in " ".join(it.get("keywords", [])).lower() for k in ["asian export", "chinese", "canton", "elephant"]) ),
    ("Sculptural Figures", lambda it: any(k in it["object_type"].lower() for k in ["figure", "sculpture", "bear", "mammoth", "rider", "horse"])),
    ("Ceremonial & Other", lambda it: True),
]


def esc(s):
    return html.escape(str(s), quote=True)


def render_field_value(key, val):
    if key == "dimensions_cm":
        parts = []
        for dim in ("length", "width", "height"):
            v = val.get(dim)
            if v:
                parts.append(f"{dim}: {v}cm")
        note = val.get("note")
        out = ", ".join(parts) if parts else ""
        if note:
            out += (" — " if out else "") + esc(note)
        return out
    if key == "inscriptions":
        if not val:
            return ""
        items = []
        for insc in val:
            raw_text = insc.get("text", "").strip().strip('"')
            text = esc(raw_text)
            loc = esc(insc.get("location", ""))
            notes = esc(insc.get("notes", ""))
            line = f"&ldquo;{text}&rdquo;"
            if loc:
                line += f" <span class='meta'>({loc})</span>"
            if notes:
                line += f"<br><span class='meta'>{notes}</span>"
            items.append(f"<li>{line}</li>")
        return "<ul>" + "".join(items) + "</ul>"
    if key == "keywords":
        if not val:
            return ""
        return " ".join(f"<span class='tag'>{esc(k)}</span>" for k in val)
    if key == "related_items":
        if not val:
            return ""
        return ", ".join(f"<a href='{rid.lower()}.html'>{esc(rid)}</a>" for rid in val)
    if isinstance(val, list):
        return "; ".join(esc(v) for v in val)
    return esc(val)


def is_empty(val):
    if val is None:
        return True
    if isinstance(val, str):
        return val.strip() == "" or val.strip().lower() == "unknown" and False  # keep "unknown" visible
    if isinstance(val, (list, dict)):
        return len(val) == 0
    return False


def load_items():
    items = []
    for p in sorted(ITEMS_DIR.glob("RHC-*.json")):
        with open(p) as f:
            items.append(json.load(f))
    return items


def group_item(it):
    for name, pred in GROUPS:
        if pred(it):
            return name
    return "Ceremonial & Other"


def render_item_page(it, items_by_id, prev_id, next_id):
    iid = it["id"]
    slug = iid.lower()
    photos = it.get("photos", [])
    thumb_parts = []
    for i, p in enumerate(photos):
        active_cls = " active" if i == 0 else ""
        thumb_parts.append(
            f"<img src='../photos/{esc(p)}' class='thumb{active_cls}' data-index='{i}' alt='{esc(iid)} photo {i+1}'>"
        )
    thumbs = "".join(thumb_parts)
    photo_json = json.dumps([f"../photos/{p}" for p in photos])

    fields_html = ""
    for key, label in FIELD_ORDER:
        val = it.get(key)
        if is_empty(val):
            continue
        rendered = render_field_value(key, val)
        if not rendered:
            continue
        fields_html += f"<div class='field'><dt>{esc(label)}</dt><dd>{rendered}</dd></div>"

    research = it.get("research_notes", "")
    research_html = ""
    if research and research.strip():
        research_html = f"""
    <section class="research-callout">
      <h2>Open Research Questions</h2>
      <p>{esc(research)}</p>
    </section>"""

    nav_links = "<div class='item-nav'>"
    if prev_id:
        nav_links += f"<a href='{prev_id.lower()}.html'>&larr; {esc(prev_id)}</a>"
    nav_links += "<a href='../index.html' class='back-link'>Back to Index</a>"
    if next_id:
        nav_links += f"<a href='{next_id.lower()}.html'>{esc(next_id)} &rarr;</a>"
    nav_links += "</div>"

    status = it.get("status", "draft")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>{esc(iid)} &mdash; {esc(it.get('title',''))}</title>
<link rel="stylesheet" href="../css/collection.css">
</head>
<body>
<div class="draft-banner">Working document &mdash; under family review, not for public distribution.</div>
<div class="wrapper">
  {nav_links}
  <header class="item-header">
    <div class="item-id">{esc(iid)} <span class="status-badge status-{esc(status)}">{esc(status)}</span></div>
    <h1>{esc(it.get('title',''))}</h1>
  </header>

  <section class="gallery">
    <div class="main-photo-wrap">
      <button class="nav-arrow prev" aria-label="Previous photo">&larr;</button>
      <img class="main-photo" src="../photos/{esc(photos[0]) if photos else ''}" alt="{esc(iid)} main photo">
      <button class="nav-arrow next" aria-label="Next photo">&rarr;</button>
    </div>
    <div class="filmstrip">{thumbs}</div>
  </section>

  <dl class="fields">
    {fields_html}
  </dl>
{research_html}

  <p class="contact-line"><a href="mailto:mike.cornelia@gmail.com">Spot an error or have something to add? Email Mike</a></p>

  {nav_links}
</div>

<div class="lightbox" id="lightbox">
  <button class="lightbox-close" aria-label="Close">&times;</button>
  <button class="nav-arrow prev" aria-label="Previous photo">&larr;</button>
  <img class="lightbox-img" src="" alt="">
  <button class="nav-arrow next" aria-label="Next photo">&rarr;</button>
</div>

<script>
const PHOTOS = {photo_json};
</script>
<script src="../js/collection.js"></script>
</body>
</html>
"""


def render_index(items):
    grouped = {}
    for it in items:
        g = group_item(it)
        grouped.setdefault(g, []).append(it)

    sections_html = ""
    for gname, _ in GROUPS:
        its = grouped.get(gname, [])
        if not its:
            continue
        tiles = ""
        for it in its:
            iid = it["id"]
            slug = iid.lower()
            photo = it.get("photos", [""])[0]
            tiles += f"""
        <a class="tile" href="items/{slug}.html">
          <img src="photos/{esc(photo)}" alt="{esc(iid)}" loading="lazy">
          <div class="tile-caption"><span class="tile-id">{esc(iid)}</span>{esc(it.get('title',''))}</div>
        </a>"""
        sections_html += f"""
    <section class="group">
      <h2>{esc(gname)}</h2>
      <div class="grid">{tiles}
      </div>
    </section>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>The Richard H. Cornelia Collection of Carved Ivory, Bone, and Horn</title>
<link rel="stylesheet" href="css/collection.css">
</head>
<body>
<div class="draft-banner">Working document &mdash; under family review, not for public distribution.</div>
<div class="wrapper">
  <header class="index-header">
    <h1>The Richard H. Cornelia Collection<br>of Carved Ivory, Bone, and Horn</h1>
    <p class="subtitle">A working digital catalog &mdash; not a formal appraisal. {len(items)} items.</p>
  </header>
{sections_html}
</div>
</body>
</html>
"""


def copy_photos(items):
    PHOTOS_DST.mkdir(parents=True, exist_ok=True)
    missing = []
    copied = 0
    for it in items:
        for p in it.get("photos", []):
            src = PHOTOS_SRC / p
            dst = PHOTOS_DST / p
            if not src.exists():
                missing.append(str(src))
                continue
            if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
                shutil.copy2(src, dst)
                copied += 1
    return copied, missing


def main():
    items = load_items()
    print(f"Loaded {len(items)} items")

    copied, missing = copy_photos(items)
    print(f"Copied {copied} photos ({len(missing)} missing)")
    for m in missing:
        print(f"  MISSING: {m}")

    ITEMS_OUT.mkdir(parents=True, exist_ok=True)
    ids = [it["id"] for it in items]
    for i, it in enumerate(items):
        prev_id = ids[i - 1] if i > 0 else None
        next_id = ids[i + 1] if i < len(items) - 1 else None
        page = render_item_page(it, {x["id"]: x for x in items}, prev_id, next_id)
        out_path = ITEMS_OUT / f"{it['id'].lower()}.html"
        out_path.write_text(page)
    print(f"Wrote {len(items)} item pages")

    index_page = render_index(items)
    (ROOT / "index.html").write_text(index_page)
    print("Wrote index.html")

    if missing:
        print(f"\nWARNING: {len(missing)} referenced photos were not found on disk.")


if __name__ == "__main__":
    main()
