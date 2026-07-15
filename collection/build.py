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

# Explicit, manually-verified per-item grouping (not derived from substring
# matching on free-text fields — that approach produced false positives,
# e.g. "bear" matching inside "beard", "engraved" matching inside the
# "not flat-engraved" keyword flag, pulling nearly everything into
# Scrimshaw). Groupings were checked against each item's `keywords` tags
# and cross-referenced with the collection's documented sub-groups.
# Re-verify/extend this map by hand whenever new items are added.
GROUP_ORDER = [
    "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "Netsuke",
    "Sculptural Figures",
    "Asian Export Carvings",
    "Personal & Utilitarian Objects",
]

GROUP_MAP = {
    # Scrimshaw (Engraved Teeth, Tusks & Plaques) — flat-engraved scenes,
    # excludes items whose keywords include "not scrimshaw technique" or
    # "not flat-engraved", and excludes RHC-040 (engraved but grouped with
    # its Chinese-export siblings instead).
    "RHC-001": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-004": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-005": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-006": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-007": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-008": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-009": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-010": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-011": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-012": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-013": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-014": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-015": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-016": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-017": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-018": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-019": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-020": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-021": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-022": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-023": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-024": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",
    "RHC-026": "Scrimshaw (Engraved Teeth, Tusks & Plaques)",

    # Netsuke — RHC-048/049 confirmed via two-differently-sized-himotoshi
    # criterion. RHC-044 ("netsuke uncertain", no himotoshi found) moved to
    # Asian Export Carvings per Mike Cornelia — better fit than Netsuke.
    "RHC-048": "Netsuke",
    "RHC-049": "Netsuke",

    # Sculptural Figures — freestanding three-dimensional carved
    # figures/animals (not handles, finials, or other functional forms).
    "RHC-027": "Sculptural Figures",
    "RHC-028": "Sculptural Figures",
    "RHC-029": "Sculptural Figures",
    "RHC-030": "Sculptural Figures",
    "RHC-031": "Sculptural Figures",
    "RHC-043": "Sculptural Figures",
    "RHC-050": "Sculptural Figures",
    "RHC-052": "Sculptural Figures",

    # Asian Export Carvings — Chinese/South-Southeast Asian export pieces,
    # per each item's "Chinese export" / "Asian export" / "East Asian
    # export" keyword tag.
    "RHC-037": "Asian Export Carvings",
    "RHC-044": "Asian Export Carvings",
    "RHC-040": "Asian Export Carvings",
    "RHC-042": "Asian Export Carvings",
    "RHC-045": "Asian Export Carvings",
    "RHC-047": "Asian Export Carvings",
    "RHC-051": "Asian Export Carvings",
    "RHC-053": "Asian Export Carvings",
    "RHC-054": "Asian Export Carvings",
    "RHC-055": "Asian Export Carvings",

    # Personal & Utilitarian Objects — grooming tools, writing/sewing
    # implements, smoking accessories, and other small functional pieces
    # that don't belong in any of the above (previously mis-grouped into
    # a vague "Ceremonial & Other" catch-all, e.g. RHC-033's comb was
    # wrongly caught by a "bear"/"beard" substring match into Sculptural).
    "RHC-002": "Personal & Utilitarian Objects",
    "RHC-003": "Personal & Utilitarian Objects",
    "RHC-025": "Personal & Utilitarian Objects",
    "RHC-032": "Personal & Utilitarian Objects",
    "RHC-033": "Personal & Utilitarian Objects",
    "RHC-034": "Personal & Utilitarian Objects",
    "RHC-035": "Personal & Utilitarian Objects",
    "RHC-036": "Personal & Utilitarian Objects",
    "RHC-038": "Personal & Utilitarian Objects",
    "RHC-039": "Personal & Utilitarian Objects",
    "RHC-041": "Personal & Utilitarian Objects",
    "RHC-046": "Personal & Utilitarian Objects",
}


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
    try:
        return GROUP_MAP[it["id"]]
    except KeyError:
        raise SystemExit(
            f"ERROR: {it['id']} has no entry in GROUP_MAP — add it to build.py "
            "before building (every item must be explicitly categorized)."
        )


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
    for gname in GROUP_ORDER:
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
  <p class="contact-line"><a href="regulatory.html">Legal &amp; Regulatory Considerations</a></p>
</div>
</body>
</html>
"""


MATERIAL_TIERS = {
    "Marine mammal material (whale tooth / walrus ivory or bone)": [
        "RHC-001", "RHC-006", "RHC-007", "RHC-008", "RHC-010", "RHC-011",
        "RHC-017", "RHC-019", "RHC-021", "RHC-022", "RHC-023", "RHC-024",
    ],
    "Likely mammoth ivory": ["RHC-014", "RHC-020", "RHC-043"],
    "Confirmed horn (not ivory)": ["RHC-002"],
    "Unresolved — presumed ivory or bone, species not confirmed": [
        "RHC-003", "RHC-004", "RHC-005", "RHC-009", "RHC-012", "RHC-013",
        "RHC-015", "RHC-016", "RHC-018", "RHC-025", "RHC-026", "RHC-027",
        "RHC-028", "RHC-029", "RHC-030", "RHC-031", "RHC-032", "RHC-033",
        "RHC-034", "RHC-035", "RHC-036", "RHC-037", "RHC-038", "RHC-039",
        "RHC-040", "RHC-041", "RHC-042", "RHC-044", "RHC-045", "RHC-046",
        "RHC-047", "RHC-048", "RHC-049", "RHC-050", "RHC-051", "RHC-052",
        "RHC-053", "RHC-054", "RHC-055",
    ],
}


def render_regulatory_page():
    tier_html = ""
    for tier_name, ids in MATERIAL_TIERS.items():
        chips = " ".join(
            f"<a href='items/{i.lower()}.html' class='tag'>{esc(i)}</a>" for i in ids
        )
        tier_html += f"""
    <div class="field">
      <dt>{esc(tier_name)}</dt>
      <dd>{len(ids)} items<br>{chips}</dd>
    </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>Legal &amp; Regulatory Considerations &mdash; The Richard H. Cornelia Collection</title>
<link rel="stylesheet" href="css/collection.css">
</head>
<body>
<div class="draft-banner">Working document &mdash; under family review, not for public distribution.</div>
<div class="wrapper">
  <div class="item-nav"><a href="index.html" class="back-link">&larr; Back to Index</a></div>
  <header class="item-header">
    <h1>Legal &amp; Regulatory Considerations</h1>
  </header>

  <section class="research-callout">
    <h2>Not legal advice</h2>
    <p>This page summarizes publicly available regulatory frameworks that are likely relevant
    to this collection, gathered during cataloging and research. It is not a legal opinion,
    not a compliance determination, and not a substitute for review by a qualified wildlife-law
    attorney or appraiser before any loan, donation, sale, or interstate/international
    transfer. Material identifications throughout this catalog are visual/presumed, not
    lab-confirmed, unless explicitly noted otherwise.</p>
  </section>

  <h2 style="margin-top:2rem;">Frameworks that likely apply</h2>
  <dl class="fields">
    <div class="field">
      <dt>New York State ivory law</dt>
      <dd>NY ECL &sect;11-0535-a prohibits the sale, offer for sale, purchase, trade, barter,
      or distribution of elephant ivory <strong>and mammoth ivory</strong> within New York
      without a state DEC permit &mdash; mammoth ivory is explicitly covered because it can be
      visually confused with elephant ivory. A narrow antique exception exists (item is 100+
      years old, ivory is less than 20% of the object, verified by a qualified appraiser), but
      permits are required even where an exception applies. This matters for any of this
      collection's presumed-ivory or mammoth-ivory items if a sale or transfer would occur in
      or through New York.</dd>
    </div>
    <div class="field">
      <dt>Federal African elephant ivory rules (ESA / 4(d) rule)</dt>
      <dd>Commercial import of African elephant ivory is prohibited. Interstate/foreign
      commercial sale can qualify under two narrow federal exceptions: (1) the <strong>ESA
      antique exception</strong> (100+ years old, documented), or (2) the <strong>de minimis
      exception</strong>, which requires <em>all three</em> of: ivory component under 200
      grams, item manufactured before July 6, 2016, and the ivory removed from the wild before
      February 26, 1976. A low weight alone (e.g. RHC-055's 140g dealer tag) satisfies only one
      of the three conditions &mdash; the other two still require separate documentation.</dd>
    </div>
    <div class="field">
      <dt>Marine Mammal Protection Act / NOAA</dt>
      <dd>Bones, teeth, and ivory from marine mammals (whale, walrus) collected from dead
      animals cannot simply be commercialized. A Letter of Determination may be required to
      possess, import, export, or sell protected-species parts, and applicants must document
      age and origin. Authentic Alaska Native handicrafts made from marine-mammal materials
      occupy a separate, narrower exempt category &mdash; relevant to items like RHC-028
      (beluga figure) if Alaska Native origin can be established, but that is not assumed by
      default.</dd>
    </div>
  </dl>

  <h2 style="margin-top:2rem;">Collection breakdown by material tier</h2>
  <p style="color:var(--text-muted);font-size:0.9rem;">Based on each item's catalog
  <code>material</code> field, which is a visual/presumed identification made during
  photography, not a lab test. This groups items by which regulatory regime most likely
  applies &mdash; it is not a valuation or condition judgment.</p>
  <dl class="fields">
    {tier_html}
  </dl>

  <h2 style="margin-top:2rem;">Recommended next steps</h2>
  <dl class="fields">
    <div class="field"><dt>1. Material testing</dt><dd>Non-destructive species/material
    testing (e.g. UV fluorescence, Schreger-line examination) for the 39 "unresolved" items
    before any sale, loan, or donation decision.</dd></div>
    <div class="field"><dt>2. Documentation assembly</dt><dd>Gather any purchase receipts,
    prior appraisals, family letters, or dealer records that establish acquisition date and
    origin &mdash; this is the single biggest lever for both legal transferability and
    value.</dd></div>
    <div class="field"><dt>3. Formal appraisal</dt><dd>A qualified appraiser experienced with
    wildlife-material antiques can combine art-historical dating with the compliance
    questions above in one pass.</dd></div>
  </dl>

  <p class="contact-line"><a href="mailto:mike.cornelia@gmail.com">Spot an error or have something to add? Email Mike</a></p>
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

    unmapped = [it["id"] for it in items if it["id"] not in GROUP_MAP]
    if unmapped:
        raise SystemExit(f"ERROR: items missing from GROUP_MAP: {unmapped}")

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

    (ROOT / "regulatory.html").write_text(render_regulatory_page())
    print("Wrote regulatory.html")

    if missing:
        print(f"\nWARNING: {len(missing)} referenced photos were not found on disk.")


if __name__ == "__main__":
    main()
