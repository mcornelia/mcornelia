# Project: mcornelia.com Website Maintenance

**Paste the section below ("Project knowledge starts here") into a new Cowork project's "Project knowledge" field.**

**Then send the test message at the bottom as your first chat message in the project to verify Claude loaded the brief correctly.**

---

## ⚡ First Message — Send this in chat to verify the brief loaded

Copy and send this as your first message in the new Cowork project. Claude should be able to answer all four without you uploading any files. If any answer is wrong, fuzzy, or invented — the brief didn't load right and you should reload it.

```
Quick test before we start working — confirm you've got the project context loaded:

1. Which page on my site has em-dashes removed, and which pages keep them?
2. If I asked you to add a new bullet to "Outside work" on my About page, which file would you edit and what HTML element/class should the bullet use?
3. What's the exact sequence of Terminal commands I run after a change?
4. Name three things you should never touch on this site.

Keep it tight. If anything's unclear, ask me before we proceed.
```

**Expected answers (so you can sanity-check):**

1. **Em-dashes removed only on `cv.html`**; other pages (Home, About, etc.) keep them — deliberate voice choice
2. **Edit `about.html`**; bullet wraps in `<p>` (the About page uses paragraphs, not `<ul>` lists for the body — check the existing "Outside work" section for pattern); content goes inside `<main class="mc-about">`
3. `cd ~/mcornelia` → `git pull origin main` → `git add -A` → `git commit -m "..."` → `git push origin main`
4. Any three of: the `<head>`/`<nav>`/`<footer>` template, `CNAME`, `css/game.css`, anything in `play/` (the games themselves), the existing AI Chief of Staff post unless asked to edit it, base CSS rules in `css/style.css` (only ADD new sections at the end).
   - Note: `posts/ai-chief-of-staff.html`, `play.html`, and `css/style.css` ARE editable — but only inside their dedicated workflows (posts authoring, code page maintenance), not as part of routine page edits.

If Claude nails 3-4 of those, you're good. If it whiffs on #1 or #4 — those are the safety-critical ones — re-paste the brief.

---

## 📋 Project knowledge starts here (copy everything below into "Project knowledge")

---

## What this project is

I maintain a personal website at **mcornelia.com**, hosted on **GitHub Pages**. It's a static site (HTML + CSS, no build step). The repo lives at https://github.com/mcornelia/mcornelia and is cloned locally at `~/mcornelia/` on my Mac. Pushing to `main` auto-deploys via GitHub Pages within ~1-2 minutes.

You'll help me update the site over time — wording changes, content tweaks, new bullets, removals, occasional structural edits.

## Site structure

The site has these pages (each is a standalone HTML file in the repo root):

| Page | URL | File | Purpose |
|---|---|---|---|
| Home | / | `index.html` | Landing page — name, tagline, intro, nav links |
| About | /about.html | `about.html` | Personal narrative, what I've built, before Meta, outside work |
| CV | /cv.html | `cv.html` | Detailed work history, experience, education |
| Code | /play.html | `play.html` | Side projects (Coding section + Arcade games) |
| Contact | /contact.html | `contact.html` | Email + social links |
| Posts | /posts/*.html | `posts/` folder | Long-form guides linked from the Code page (see inventory below) |

**Note**: As of 2026-05-01, the Writing page was removed. The substantive AI Chief of Staff guide moved to discovery via the Code page only. The other three thin posts (Workforce, AI-Native, Commissioning) were deleted entirely. The `posts/` folder remains for the AI Chief of Staff guide and any future long-form guides.

**Current posts (newest first)**:

| Post | URL | File |
|---|---|---|
| AI Chief of Staff (101 guide) | /posts/ai-chief-of-staff.html | `posts/ai-chief-of-staff.html` |

Other folders:
- `css/style.css` — global styles (don't regenerate; edit directly if styling needs to change)
- `css/game.css` — game page styles
- `js/` — minimal JavaScript (mostly for the games)
- `play/` — individual game pages (rack-invaders.html, asteroids.html)
- `CNAME` — custom domain config (don't touch)

## Template structure (every page)

Every page follows this skeleton. The `<main>` block changes; the `<head>`, `<nav>`, and `<footer>` stay constant across pages:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Page Title] - Mike Cornelia</title>
  <meta name="description" content="[page description]">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
<div class="site-wrapper">
  <nav class="site-nav">
    <div class="nav-name"><a href="/">Mike Cornelia</a></div>
    <ul class="nav-links">
      <li><a href="/about.html">About</a></li>
      <li><a href="/cv.html">CV</a></li>
      <li><a href="/play.html">Code</a></li>
      <li><a href="/contact.html">Contact</a></li>
    </ul>
  </nav>
  <main class="mc-[pagename]">
    [Page content here]
  </main>
  <footer class="site-footer">
    &copy; 2026 Mike Cornelia
  </footer>
</div>
</body>
</html>
```

The active page in nav gets `class="active"` added to its `<a>` tag.

## CSS class conventions used in `<main>`

- Home page: `<main class="mc-home">` — uses `<h1>`, `<p class="mc-tagline">`, `<div class="mc-intro">`, `<div class="mc-nav-links">`
- About: `<main class="mc-about">` — uses `<h1>`, `<p class="mc-lede">` (first paragraph), `<h2>`, `<p>`, `<strong>` for emphasis
- CV: `<main class="mc-cv">` — uses `<h1>`, `<p class="mc-cv-subtitle">`, `<p class="mc-cv-name">`, `<p class="mc-cv-contact">`, `<p class="mc-cv-summary">`, `<h2 class="mc-section-title">`, `<h3 class="mc-role-title">`, `<p class="mc-role-meta">`, `<p class="mc-role-desc">`, `<h4>` for subsections, `<ul><li>`, `<hr>` between roles
- Contact: `<main class="mc-contact">` — uses `<h1>`, `<p class="mc-contact-email">`, `<p class="mc-contact-links">`
<!-- Writing page removed 2026-05-01. The mc-writing CSS classes still exist in css/style.css but are unused (legacy / dead code). Leave them — removal not worth the touch surface. -->
- Code page: `<main class="mc-game">` — uses `<h1>`, `<p class="mc-game-subtitle">`, then `<div class="game-menu">` containing `<a class="game-card">` tiles (for games) or `<a class="game-card vibe-card">` tiles (for AI/coding side projects). Each tile has `<div class="game-card-icon">`, `<h2>`, `<p>`. Sections separated by `<hr class="play-divider">`.
- Posts: `<main class="mc-post">` — see "Posts authoring conventions" section below for the full pattern + rich-content classes

Match these conventions when generating HTML.

## HTML entity conventions

When generating or editing HTML, encode these characters as HTML entities for safety:

| Character | Entity |
|---|---|
| `'` (right single quote / apostrophe) | `&rsquo;` |
| `'` (left single quote) | `&lsquo;` |
| `"` (right double quote) | `&rdquo;` |
| `"` (left double quote) | `&ldquo;` |
| `—` (em dash) | `&mdash;` |
| `–` (en dash) | `&ndash;` |
| `→` (arrow) | `&rarr;` |
| `·` (middle dot) | `&middot;` |
| `&` (ampersand in text) | `&amp;` |
| `©` (copyright) | `&copy;` |
| `≤` `≥` `<` `>` (when inside text, not tags) | `&le;` `&ge;` `&lt;` `&gt;` |

Always quote-encode in HTML; don't paste raw smart quotes.

## Important rules and policies

**Em-dashes on the CV page**: I removed all em-dashes from the CV per recruiter advice (em-dashes signal AI-generated content to ATS scanners and human reviewers). When editing `cv.html`, use commas, semicolons, or colons instead of em-dashes. Other pages (Home, About, etc.) can keep em-dashes — I have a deliberate voice there.

**Three workflows, three scopes:**

- **Routine maintenance** (default scope): you help me update Home, About, CV, and Contact. Don't touch anything else unless I explicitly invoke one of the workflows below.
- **Posts authoring** (separate scope): adding a new blog post, updating `writing.html`, or extending `css/style.css` for new post features (tables, code blocks, etc.). I'll say something like "let's add a new post" or "we're authoring."
- **Code page maintenance** (separate scope): adding/editing tiles on `play.html` (the Code page) — new side project tiles, new arcade games, link updates, target attribute changes. I'll say something like "add a tile" or "edit the Code page."

**Things to NEVER touch in the routine maintenance workflow**:
- `css/style.css` — global styles, only edit during posts authoring (when adding new rich-content sections)
- `play.html`, `writing.html`, anything in `posts/` or `play/` — these belong to the posts authoring or code page workflows
- The `<head>`, `<nav>`, or `<footer>` — only the `<main>` block changes when updating content
- `CNAME` file (custom domain config)

**Even in the posts authoring workflow, NEVER touch**:
- `<head>`, `<nav>`, `<footer>` template (still constant across pages)
- `CNAME`
- Existing posts unless I explicitly ask to edit them
- The base CSS rules (only ADD new sections at the end of `css/style.css`)
- `play.html` or anything in `play/`

**Even in the code page workflow, NEVER touch**:
- `<head>`, `<nav>`, `<footer>` template
- `CNAME`
- Existing tiles unless I explicitly ask to edit them
- The arcade games themselves (anything in `play/` like `rack-invaders.html`, `asteroids.html`)
- `css/game.css` (only edit if I explicitly ask)
- `posts/`, `writing.html`

**Always preserve**:
- Class names exactly as they are (`mc-cv`, `mc-role-title`, etc.)
- The active nav class (the page you're editing keeps `class="active"` on its nav link)
- The footer copyright year

## Posts authoring conventions (when adding a new blog post)

When I tell you we're authoring a new post (not doing routine maintenance), here's the playbook:

**1. Create the post HTML** at `posts/<slug>.html`. Use the existing posts as templates (`posts/workforce.html`, `posts/ai-chief-of-staff.html`). The wrapper is `<main class="mc-post">` with `<a class="mc-post-back">`, `<div class="mc-post-header">`, then content.

**2. Update `writing.html`** — add a new `<li class="mc-post-item">` at the **top** of the `<ul class="mc-post-list">` (newest first ordering).

**3. Available rich-content classes** (defined in `css/style.css` under "BLOG POSTS — RICH CONTENT EXTENSIONS"):

| Element | When to use | HTML pattern |
|---|---|---|
| Standard tables | Comparisons, inventories | `<table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>` |
| Copy-pasteable prompt blocks | Long prompts users will copy | `<div class="mc-prompt-block"><div class="mc-prompt-label">Label here</div><pre>...prompt...</pre></div>` |
| Checklists (☐) | Action lists at end of posts | `<ul class="mc-checklist"><li>Item</li></ul>` |
| Callout boxes | "Important — read this" framing | `<div class="mc-callout"><p><strong>Headline.</strong></p><p>Body.</p></div>` |
| Stat cards | Proof points / numbers | `<div class="mc-stat-row"><div class="mc-stat"><div class="mc-stat-number">5×</div><div class="mc-stat-label">label</div><div class="mc-stat-source">attribution</div></div></div>` |

**4. If a post needs a NEW kind of element** not on this list, add a new section to the bottom of `css/style.css` (under the "BLOG POSTS — RICH CONTENT EXTENSIONS" header). Then update this table so the next post can reuse it.

**5. Em-dashes are fine in posts** — only the CV strips them. Posts are personal voice.

**6. SEO meta block** — every new post needs the full SEO `<head>` block (see "SEO conventions" section below). At minimum: canonical URL, OG tags, Twitter Card tags, Article JSON-LD with `datePublished`, keyword-tuned title and description. Use existing posts as templates.

## Code page maintenance conventions (when adding or editing tiles on `play.html`)

When I tell you we're editing the Code page, here's the playbook:

**Two sections on `play.html`** (Coding intentionally appears first — substantive work above fun stuff):

- **Coding** (top half): AI/coding side projects and guides. Heading uses `class="vibe-heading"` (blue glow, monospace), subtitle uses `class="vibe-subtitle"`, tile container uses `class="game-menu vibe-menu"`, tiles use `class="game-card vibe-card"`. Tiles open in **new tabs** (`target="_blank" rel="noopener"`) — even internal links.
- **Arcade** (bottom half, after `<hr class="play-divider">`): retro browser games, individual files in `play/` (e.g., `play/rack-invaders.html`). Plain `<h1>` heading and `mc-game-subtitle`. Tiles use class `game-card` (no vibe-card) and link internally — they open in the same window (intentional).

**Tile HTML pattern:**

```html
<a href="[URL]" class="game-card vibe-card" target="_blank" rel="noopener">
  <div class="game-card-icon">[HTML entity for emoji icon]</div>
  <h2>Tile Title</h2>
  <p>One or two sentences. Match the punchy, action-oriented voice of the existing tiles.</p>
</a>
```

**Icon convention**: Use unique HTML entity emoji per tile (`&#x1F916;` 🤖, `&#x1F4D0;` 📐, `&#x1F3A9;` 🎩, `&#x1F4E1;` 📡, etc.). Don't reuse icons across tiles in the same section.

**Description voice**: Compare to existing tiles. Two short sentences max. Action-first. No fluff.

**Current Coding tiles (newest last):**

| Tile | Target | Icon |
|---|---|---|
| OpenClaw Setup Guide | https://mcornelia.github.io/openclaw-setup-guide | 🤖 `&#x1F916;` |
| Room Layout Tool | https://mcornelia.github.io/room-layout-tool | 📐 `&#x1F4D0;` |
| AI Chief of Staff Setup | /posts/ai-chief-of-staff.html | 🎩 `&#x1F3A9;` |
| Mountain Mesh Setup Guide | https://mcornelia.github.io/mountain-mesh-node-guide | 📡 `&#x1F4E1;` |

**To add a new tile**: append to the `<div class="game-menu vibe-menu">` block (after Mountain Mesh). To reorder: cut and paste the `<a>` block to a new position.

**To edit the Arcade section**: same pattern, but tiles drop the `vibe-card` class and `target="_blank"` attributes.

## SEO conventions (every page, baked into the `<head>`)

The site is optimized for two audiences:
1. **Recruiters / network** Googling "Mike Cornelia" → Person JSON-LD on home + about (clean Knowledge Panel)
2. **Industry readers** finding posts via topic search → Article JSON-LD + topic keywords on posts

Every page `<head>` block must include:

**Standard meta** (all pages):
- `<title>` — keyword-tuned, includes role or topic
- `<meta name="description">` — keyword-rich, ~150-160 chars
- `<meta name="author" content="Mike Cornelia">`

**Canonical URL** (all pages):
- `<link rel="canonical" href="https://mcornelia.com/[path]">`

**Open Graph tags** (all pages — controls LinkedIn/Slack/iMessage previews):
- `og:type` — `website` for landing pages, `profile` for about/cv, `article` for blog posts
- `og:title`, `og:description`, `og:url`, `og:image`, `og:site_name`

**Twitter Card tags** (all pages):
- `twitter:card` — `summary_large_image`
- `twitter:title`, `twitter:description`, `twitter:image`

**OG images** (split between site default + per-post):
- **Main pages** (Home, About, CV, Writing, Code, Contact) use `https://mcornelia.com/og-image.png`. Generated from `~/gdrive/03_resources/visualizations/og_image.html` (1200×630). Lives at `/og-image.png`.
- **Each blog post** uses its own dedicated OG image at `https://mcornelia.com/og-images/[slug].png`. Generated from `~/gdrive/03_resources/visualizations/og_images/post_[slug].html`. Lives at `/og-images/[slug].png`.
- When adding a new post: create a new per-post OG template by copying one of the existing `og_images/post_*.html` files, swap the title/tags/accent color, screenshot, save as `/og-images/[slug].png`. Then reference that path in the post's OG meta.

**Person JSON-LD** (home + about only):
- `@type: Person`, includes name, jobTitle, worksFor, url, sameAs (social profiles), address, knowsAbout (skill keywords)

**Article JSON-LD** (every blog post):
- `@type: BlogPosting`, includes headline, description, image, url, datePublished, dateModified, author, publisher, mainEntityOfPage, keywords
- Also add `<meta property="article:published_time">`, `article:section`, `article:tag` (multiple)
- Also add `<meta name="keywords">` with topic-specific terms

**When adding a NEW post** — copy the head from `posts/ai-chief-of-staff.html` and update:
- title, description, keywords (meta + JSON-LD)
- canonical URL, og:url, JSON-LD url, mainEntityOfPage @id (all 4 must match)
- article:published_time + JSON-LD datePublished + dateModified
- article:section + article:tag (multiple)
- og:title, twitter:title (typically shorter than full `<title>`)
- og:description, twitter:description (typically shorter than `<meta name="description">`)
- JSON-LD headline (matches `<h1>`, often longer than og:title)
- og:image, twitter:image, JSON-LD image — point to `/og-images/[slug].png`
- Create the per-post OG image: copy a template from `~/gdrive/03_resources/visualizations/og_images/`, swap title/tags/accent color, screenshot at 1200×630, save as `og-images/[slug].png` in the website folder

**Sitemap + robots** — `sitemap.xml` lives at site root and lists every page with lastmod/changefreq/priority. When adding a new post or page, ADD it to sitemap.xml. `robots.txt` (also at root) allows all crawlers and points to the sitemap. Don't touch `robots.txt` unless you're explicitly changing crawler policy.

**When adding a NEW main page** — copy the head from `about.html` (if profile-style) or `play.html` (if functional) and update title, description, canonical URL, og:url, JSON-LD url. Skip article-specific tags.

## Workflow: how I update the site

You'll typically help me in one of these patterns:

**Pattern 1 — I describe a change**
> "Remove the X line from my CV"
> "Change the phrase Y to Z on the About page"
> "Add a new bullet under [section] saying [text]"

For these: tell me which file and line to edit, give me the exact replacement text or HTML, and remind me of the push commands at the end.

**Pattern 2 — I paste new content**
> "Here's a new About section, generate the HTML"

For these: take the prose, generate HTML matching the template/class conventions above, encode entities, return the HTML block I should paste into `<main>` of the file.

**Pattern 3 — I want to read the current site**
Tell me the URL or ask me to paste the file contents. I'll provide them.

## Push workflow (always remind me at the end of an update)

After any change, I push to GitHub from Terminal:

```bash
cd ~/mcornelia
git pull origin main
git add -A
git commit -m "[brief description of change]"
git push origin main
```

GitHub Pages rebuilds automatically in ~1-2 minutes. To verify, hit the URL in incognito (regular browser may show a cached old version).

## About me (context for tone)

I'm a data center operations leader, 13 years at Meta. Voice on the site is direct, technical, lightly humorous. Not corporate, not stiff. The CV is more formal than the About page. The Home page is casual and inviting.

## Communication style I prefer

- Direct and concise. No flattery.
- If you flag something I should consider before acting, do it once — don't pile on.
- Pithy and a little sarcastic is fine.
- When you make a change, tell me exactly what changed and what I need to do next.
- Don't ask for permission for trivial edits I clearly want made. Do ask for confirmation on bigger structural changes.

---

## Sister repos that share styling

These are separate GitHub Pages sites linked from the Code page. They intentionally use the same dark terminal CSS for brand consistency. They're NOT part of mcornelia.com — different repos, different `.github.io` URLs — but each one shares the same SEO + OG conventions as the main site.

| Sister repo | URL | Purpose | gdrive clone path |
|---|---|---|---|
| `mcornelia/mountain-mesh-node-guide` | https://mcornelia.github.io/mountain-mesh-node-guide | Meshtastic LoRa setup guide for the Mountain Mesh network | `01_projects/18_mountain_mesh_node_guide/` |
| `mcornelia/openclaw-setup-guide` | https://mcornelia.github.io/openclaw-setup-guide | Interactive OpenClaw AI agent setup guide | `01_projects/19_openclaw_setup_guide/` |
| `mcornelia/room-layout-tool` | https://mcornelia.github.io/room-layout-tool | Drag-and-drop floor plan designer | `01_projects/20_room_layout_tool/` |

Each sister repo has:
- A near-verbatim copy of `css/style.css`
- Full SEO `<head>` block (canonical, OG, Twitter Card, JSON-LD — see SEO conventions section above)
- A per-page OG image at `/og-image.png` (template in `~/gdrive/03_resources/visualizations/og_images/`)
- `sitemap.xml` and `robots.txt` at root

If I ask to restyle one of these, treat it as its own scope — don't bleed mcornelia.com edits into it. If I update the master `css/style.css` here, I may want the same change propagated to the sister repos — I'll tell you when.

**Pushing sister repos**: each is a separate git repo. Push from the gdrive clone path with the standard `git add -A && git commit && git push origin main` flow.

---

**To use this brief**: Create a new project in Claude.ai (Cowork) called "mcornelia.com website", paste this entire document into "Project knowledge", and start asking Claude to help with site updates.
