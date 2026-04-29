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
4. Any three of: `css/style.css`, `play.html`, `writing.html`, anything in `posts/` or `play/`, the `<head>`/`<nav>`/`<footer>` template, `CNAME`

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
| Code | /play.html | `play.html` | Side projects (games + AI/coding side projects) |
| Writing | /writing.html | `writing.html` | Blog posts index |
| Contact | /contact.html | `contact.html` | Email + social links |
| Posts | /posts/*.html | `posts/` folder | Individual blog posts |

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
      <li><a href="/writing.html">Writing</a></li>
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

**Things to NEVER touch**:
- `css/style.css` — global styles, only edit if I explicitly ask
- `play.html`, `writing.html`, anything in `posts/` or `play/` — these are managed separately
- The `<head>`, `<nav>`, or `<footer>` — only the `<main>` block changes when updating content
- `CNAME` file (custom domain config)

**Always preserve**:
- Class names exactly as they are (`mc-cv`, `mc-role-title`, etc.)
- The active nav class (the page you're editing keeps `class="active"` on its nav link)
- The footer copyright year

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

**To use this brief**: Create a new project in Claude.ai (Cowork) called "mcornelia.com website", paste this entire document into "Project knowledge", and start asking Claude to help with site updates.
