# mcornelia.com — WordPress.com Code

## How to Use This

### Global CSS
1. Go to **Appearance > Customize > Additional CSS**
2. Paste the entire CSS section below
3. Click **Publish**

### Pages (Home, About, CV, Contact)
1. Create a new Page
2. In the block editor, click the **three dots** (top right) > **Code editor**
3. Paste the HTML for that page
4. Switch back to **Visual editor** to preview
5. Publish

### Blog Posts (Writing section)
1. Create each as a regular **Post**
2. Same process — Code editor, paste HTML, switch back to Visual

### Navigation
1. Go to **Appearance > Menus**
2. Create a menu with: About, CV, Writing (link to your blog page), Contact
3. Set Home page: **Settings > Reading > "A static page" > select your Home page**
4. Set Posts page: create a blank page called "Writing" and select it as Posts page

---

## GLOBAL CSS

Paste this into **Appearance > Customize > Additional CSS**:

```css
/* ============================================
   mcornelia.com — Global Styles
   ============================================ */

/* --- Base --- */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
  color: #1a1a1a;
  background: #ffffff;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

/* --- Constrain content width --- */
.entry-content,
.page-content,
.post-content {
  max-width: 680px;
  margin-left: auto;
  margin-right: auto;
  padding: 0 1.5rem;
}

/* --- Typography --- */
h1, h2, h3, h4 {
  color: #1a1a1a;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

h1 { font-size: 2.25rem; margin-top: 3rem; margin-bottom: 1rem; }
h2 { font-size: 1.5rem; margin-top: 2.5rem; margin-bottom: 0.75rem; }
h3 { font-size: 1.2rem; margin-top: 2rem; margin-bottom: 0.5rem; }

p {
  font-size: 1.05rem;
  margin-bottom: 1.25rem;
  color: #2a2a2a;
}

/* --- Links --- */
a {
  color: #1a6b8a;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

a:hover {
  border-bottom-color: #1a6b8a;
}

/* --- Horizontal rules --- */
hr {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 2.5rem 0;
}

/* --- Lists --- */
ul, ol {
  padding-left: 1.25rem;
  margin-bottom: 1.25rem;
}

li {
  font-size: 1.05rem;
  margin-bottom: 0.4rem;
  color: #2a2a2a;
}

/* ============================================
   HOME PAGE
   ============================================ */

.mc-home {
  padding: 6rem 0 4rem;
  text-align: left;
}

.mc-home h1 {
  font-size: 2.75rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}

.mc-home .mc-tagline {
  font-size: 1.15rem;
  color: #555;
  font-weight: 500;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.mc-home .mc-intro {
  font-size: 1.1rem;
  color: #2a2a2a;
  line-height: 1.8;
  margin-bottom: 2.5rem;
}

.mc-home .mc-nav-links {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 2rem;
}

.mc-home .mc-nav-links a {
  font-size: 1rem;
  font-weight: 600;
  color: #1a6b8a;
  border-bottom: 2px solid #1a6b8a;
  padding-bottom: 2px;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.mc-home .mc-nav-links a:hover {
  color: #134f66;
  border-bottom-color: #134f66;
}

/* ============================================
   ABOUT PAGE
   ============================================ */

.mc-about {
  padding: 3rem 0 4rem;
}

.mc-about h1 {
  margin-bottom: 1.5rem;
}

.mc-about h2 {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.mc-about .mc-lede {
  font-size: 1.15rem;
  color: #444;
  line-height: 1.8;
  margin-bottom: 1.5rem;
}

/* ============================================
   CV PAGE
   ============================================ */

.mc-cv {
  padding: 3rem 0 4rem;
}

.mc-cv h1 {
  margin-bottom: 0.5rem;
}

.mc-cv .mc-cv-subtitle {
  font-size: 1rem;
  color: #777;
  margin-bottom: 2rem;
}

.mc-cv .mc-cv-header {
  margin-bottom: 2rem;
}

.mc-cv .mc-cv-header h2 {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
  border: none;
  padding: 0;
}

.mc-cv .mc-cv-header .mc-cv-contact {
  font-size: 0.95rem;
  color: #666;
}

.mc-cv .mc-cv-summary {
  font-size: 1.05rem;
  color: #2a2a2a;
  line-height: 1.8;
  padding: 1.25rem 0;
  border-top: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 2rem;
}

.mc-cv h2 {
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #999;
  font-weight: 600;
  margin-top: 2.5rem;
  margin-bottom: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.mc-cv h3 {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
  margin-top: 2rem;
  color: #1a1a1a;
}

.mc-cv .mc-role-meta {
  font-size: 0.95rem;
  color: #666;
  margin-bottom: 0.75rem;
  font-weight: 500;
}

.mc-cv .mc-role-desc {
  font-size: 1rem;
  color: #2a2a2a;
  margin-bottom: 0.75rem;
}

.mc-cv h4 {
  font-size: 0.95rem;
  font-weight: 700;
  color: #444;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

.mc-cv ul {
  padding-left: 1.25rem;
  margin-bottom: 1rem;
}

.mc-cv li {
  font-size: 0.95rem;
  margin-bottom: 0.35rem;
  line-height: 1.6;
}

.mc-cv .mc-competencies {
  font-size: 0.95rem;
  color: #555;
  line-height: 1.8;
}

.mc-cv .mc-education p {
  font-size: 1rem;
  margin-bottom: 0.35rem;
}

.mc-cv .mc-education strong {
  font-weight: 600;
}

/* ============================================
   WRITING / BLOG
   ============================================ */

.post h1,
.entry-title {
  font-size: 1.75rem;
}

.post p,
.entry-content p {
  font-size: 1.05rem;
  line-height: 1.8;
}

blockquote {
  border-left: 3px solid #1a6b8a;
  padding-left: 1.25rem;
  margin: 1.5rem 0;
  color: #444;
  font-style: normal;
}

/* ============================================
   CONTACT PAGE
   ============================================ */

.mc-contact {
  padding: 6rem 0 4rem;
}

.mc-contact h1 {
  margin-bottom: 2rem;
}

.mc-contact .mc-contact-email {
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.mc-contact .mc-contact-email a {
  color: #1a1a1a;
  border-bottom: 2px solid #1a6b8a;
}

.mc-contact .mc-contact-links {
  font-size: 1.05rem;
  color: #555;
}

.mc-contact .mc-contact-links a {
  color: #1a6b8a;
  font-weight: 500;
}

.mc-contact .mc-contact-links span {
  margin: 0 0.5rem;
  color: #ccc;
}

/* ============================================
   RESPONSIVE
   ============================================ */

@media (max-width: 600px) {
  .mc-home h1 { font-size: 2rem; }
  .mc-home { padding: 3rem 0 2rem; }
  .mc-contact { padding: 3rem 0 2rem; }
  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.3rem; }
}
```

---

## PAGE: Home

```html
<div class="mc-home">

<h1>Mike Cornelia</h1>

<p class="mc-tagline">Data center operations executive. 13 years at hyperscale.<br>Building and operating infrastructure at gigawatt scale.</p>

<p class="mc-intro">I lead data center operations for one of the largest AI infrastructure fleets in the world — 14 campuses, 2,500+ MW, roughly one quarter of the GPU compute and power capacity across the entire fleet.</p>

<p class="mc-intro">Before that, I spent a decade in IT infrastructure, building systems from the ground up for organizations that needed things to just work.</p>

<p class="mc-intro">I think a lot about how operations scales, where AI changes the game, and why the workforce model is the hardest problem in the industry right now.</p>

<div class="mc-nav-links">
  <a href="/about">About me</a>
  <a href="/cv">Read my CV</a>
  <a href="/writing">Writing</a>
</div>

</div>
```

---

## PAGE: About

```html
<div class="mc-about">

<h1>About</h1>

<p class="mc-lede">I've spent my career in infrastructure — first building IT systems for small and mid-size businesses, then operating data centers at a scale that didn't exist when I started.</p>

<p>I joined Meta in 2013 as an operations manager at a single data center in North Carolina. Over the next 13 years, I grew with the fleet — from under 1 GW of total deployed capacity to over 12 GW. Today I direct operations for the South region: 14 campuses across six states and international leased facilities, representing the largest concentration of AI compute in the company.</p>

<h2>What I've built</h2>

<p><strong>Regions from the ground up.</strong> I've commissioned new data center regions from empty buildings to production traffic — most recently delivering the first all-Turin server region on schedule, with receiving rates up to 750 racks per week. Right now I'm managing 12+ concurrent builds, expansions, and facility activations delivering 150 to 330 MW of new capacity every quarter.</p>

<p><strong>Organizations that scale.</strong> Gigawatt-class campuses break traditional management models. I co-authored an organizational restructuring that moved from per-site management to an infrastructure-ring-based model, achieving a 34% reduction in management overhead while scaling capacity 3x. I've also led workforce planning and insourcing analysis across 500+ positions, building staffing models that project through 2030.</p>

<p><strong>Quality systems that work.</strong> I sponsored a cross-organizational quality metrics overhaul that introduced composite scoring frameworks, retired legacy metrics, and brought LLM-powered quality assessment to repair ticket evaluation. I launched a diagnostic accuracy program that reduces repeat repairs — directly bending the hiring curve by making each technician more effective.</p>

<p><strong>AI into how I operate.</strong> I don't just govern AI initiatives — I use AI tools daily. I've built AI agents into my own workflow for meeting prep, workforce modeling, data analysis, and operational reporting. That hands-on fluency shapes how I evaluate and sponsor AI programs across the organization, from agentic repair systems to human-in-the-loop troubleshooting agents.</p>

<h2>Before Meta</h2>

<p>I spent 13 years in IT infrastructure. I designed and deployed systems across Unix, Linux, VMware, and Windows environments as a systems engineer and architect. I co-created a managed cloud services offering. I directed technology operations for a multi-location retailer with around 400 employees, partnering with the CEO and CFO on strategy and managing all infrastructure end to end.</p>

<p>I started my career as a hands-on engineer. That foundation — understanding how systems actually work, not just how they look on a slide — still shapes how I lead.</p>

<h2>Outside work</h2>

<p>I'm a graduate of Leadership North Carolina, a selective statewide leadership program. I represent my company in state-level legislative advocacy for data center tax incentives and maintain relationships with government officials, economic development authorities, and community organizations across the Southeast.</p>

<p>I live in Athens, Georgia.</p>

</div>
```

---

## PAGE: CV

```html
<div class="mc-cv">

<h1>CV</h1>
<p class="mc-cv-subtitle">For a downloadable version, <a href="/contact">get in touch</a>.</p>

<div class="mc-cv-header">
  <h2 style="font-size:1.75rem; text-transform:none; letter-spacing:normal; color:#1a1a1a; border:none; padding:0; margin-top:0;">T. Michael Cornelia</h2>
  <p class="mc-cv-contact">Athens, GA&ensp;·&ensp;<a href="https://linkedin.com/in/mcornelia">LinkedIn</a>&ensp;·&ensp;<a href="/contact">Contact</a></p>
</div>

<p class="mc-cv-summary">Data center operations executive with 13+ years at Meta, leading infrastructure operations through fleet expansion from under 1 GW to over 12 GW. Currently directing operations for a 14-site region representing approximately one quarter of the company's GPU fleet and power capacity. Expertise spans new region commissioning, workforce strategy, AI-driven operations, cloud/colo hybrid models, quality systems, and organizational design at hyperscale.</p>

<h2>Experience</h2>

<h3>Director, Global Operations — South Region</h3>
<p class="mc-role-meta">Meta Platforms, Inc. · 2025 – Present</p>
<p class="mc-role-desc">Direct all site operations for Meta's South region — 14 data center campuses across Georgia, North Carolina, Texas, Louisiana, Virginia, and international leased facilities. Manage 8 direct reports overseeing production operations, capacity delivery, and site readiness across 2,500+ MW of infrastructure.</p>

<h4>Scale & Growth</h4>
<ul>
  <li>Own the largest regional concentration of AI compute infrastructure in Meta's fleet — approximately one quarter of global GPU capacity and total megawatts</li>
  <li>Scaling region from ~900 MW to ~2,500 MW in two years, including a 500+ MW cluster purpose-built for generative AI training</li>
  <li>Oversee 12+ concurrent new builds, expansions, temporary structures, and leased activations delivering 150–330 MW per quarter</li>
</ul>

<h4>New Region Turn-Up & Commissioning</h4>
<ul>
  <li>Delivered Meta's first all-Turin server region on schedule — pilot site for an accelerated capacity program targeting 80% reduction in fulfillment time</li>
  <li>Achieved 2,063 racks positioned at rates up to 750 racks/week with a single-day record of 200 racks</li>
  <li>Manage continuous pipeline of turn-ups across liquid-cooled facilities, rapid deployment structures, cable expansions, and leased data centers</li>
</ul>

<h4>Organizational Strategy & Workforce Planning</h4>
<ul>
  <li>Co-authored ring-aligned restructuring proposal — transformed operations from per-site management to infrastructure-ring-based model, achieving 34% management reduction while scaling to gigawatt-class campuses</li>
  <li>Designed and executed major organizational restructuring — centralized enablement functions, optimized headcount, and managed role eliminations while preserving tax incentive compliance</li>
</ul>

<h4>Capacity Planning & Risk Management</h4>
<ul>
  <li>Created region-level capacity delivery risk framework combining construction risk with operational signals into a unified, continuously refreshed executive dashboard</li>
  <li>Standardized capacity engineering processes, launched root cause corrective action (RCCA) framework, and established quarterly quality assessments</li>
  <li>Manage region against rack turn-up SLO (P90 &lt; 5 days), redeployment SLO (P95 &lt; 4 days), and decommission targets with per-site tracking</li>
</ul>

<h4>AI & Emerging Technology</h4>
<ul>
  <li>Established governance framework for converging AI initiatives — agentic AI for automated repair, human-in-the-loop troubleshooting agents, and AI-powered quality scoring</li>
  <li>Launched cloud operations pilot across multiple public cloud providers (OCI, GCP, and others), defining the support model for heterogeneous cloud infrastructure</li>
</ul>

<h4>Government Relations & Community</h4>
<ul>
  <li>Represent Meta in state-level legislative advocacy for data center tax incentive preservation — active on bills affecting hundreds of millions in exemptions</li>
  <li>Graduate of Leadership North Carolina; maintain statewide network of leaders across public and private sectors</li>
  <li>Manage relationships with government officials, economic development authorities, and community organizations across six states</li>
</ul>

<hr>

<h3>Director, Site Operations — Stanton Springs, GA</h3>
<p class="mc-role-meta">Meta Platforms, Inc. · 2022 – 2025</p>
<p class="mc-role-desc">Directed site operations for Meta's Stanton Springs (Newton County, GA) data center campus — one of the fastest-growing campuses in the fleet.</p>
<ul>
  <li>Sponsored enterprise-wide Quality Metrics Workshop — produced a multi-tier composite scoring framework, retired legacy metrics, and introduced LLM-based quality assessment of repair tickets</li>
  <li>Built and deployed an operational excellence framework (1:1 templates, meeting cadences, analytics SOPs) adopted across all regions globally</li>
  <li>Launched diagnostic accuracy initiative to reduce repeat repairs and lower headcount growth — quantified cost impact to justify tooling investments</li>
  <li>Led insourcing business case analyzing contingent vs. FTE economics across 500+ positions, including staffing models for gigawatt-scale sites through 2030</li>
  <li>Built government and community relationships across Newton County and the state of Georgia</li>
</ul>

<hr>

<h3>Data Center Operations Manager — Stanton Springs, GA</h3>
<p class="mc-role-meta">Meta Platforms, Inc. · 2018 – 2022</p>
<p class="mc-role-desc">Managed infrastructure operations teams at Meta's Stanton Springs campus during a period of rapid expansion and new building commissioning.</p>
<ul>
  <li>Owned all capacity-related projects across the campus, including new building commissioning and expansion phases</li>
  <li>Managed cross-functional coordination across construction, production operations, and headquarters teams for turn-up, turn-down, and retrofit execution</li>
  <li>Developed operational processes and standards subsequently adopted at other sites</li>
  <li>Mentored individual contributors across multiple technical teams</li>
</ul>

<hr>

<h3>Data Center Operations Manager — Forest City, NC</h3>
<p class="mc-role-meta">Meta Platforms, Inc. (formerly Facebook) · 2013 – 2018</p>
<p class="mc-role-desc">Led infrastructure teams at Meta's North Carolina campus during rapid fleet expansion.</p>
<ul>
  <li>Owned all capacity-related projects across the campus, including commissioning of the site's second data center building</li>
  <li>Managed cross-functional coordination across construction, production operations, and headquarters teams for turn-up, turn-down, and retrofit execution</li>
  <li>Developed capacity processes adopted fleet-wide; mentored individual contributors across multiple teams</li>
  <li>Built local government and community engagement relationships at city and county levels</li>
</ul>

<hr>

<h3>Earlier Career</h3>

<p class="mc-role-desc"><strong>System Engineer & Architect</strong> — SUM/IT Systems · 2004 – 2013<br>
Designed and deployed systems solutions (Unix, Linux, VMware, Windows Server) for SMB customers. Co-created the company's cloud offering and managed full customer lifecycle from scoping through long-term support.</p>

<p class="mc-role-desc"><strong>VP, Operations & Information Systems</strong> — The School Box, Inc. · 2000 – 2013<br>
Directed technology operations for a multi-location Southeast retailer (~400 employees). Managed all infrastructure, partnered with CEO/CFO on strategy and budgets, and built the organization's primary knowledge management platform.</p>

<h2>Core Competencies</h2>

<p class="mc-competencies">Data Center Operations · Hyperscale Infrastructure (1 GW+) · New Site Commissioning · Liquid Cooling · Capacity Planning & Delivery · SLO Management · GPU Fleet Operations · AI/ML Training Clusters · Agentic AI for Operations · Multi-Cloud (OCI, AWS, GCP) · Colocation Management · Workforce Strategy · Insourcing Analysis · Organizational Design · Quality Systems · Operational Excellence · Legislative Advocacy · Government Affairs</p>

<h2>Education & Certifications</h2>

<div class="mc-education">
  <p><strong>Leadership North Carolina</strong> — Graduate</p>
  <p><strong>University of Georgia</strong> — Business Management</p>
  <p><strong>Red Hat Certified Engineer (RHCE)</strong></p>
  <p><strong>Red Hat Certified System Administrator (RHCSA)</strong></p>
</div>

</div>
```

---

## PAGE: Contact

```html
<div class="mc-contact">

<h1>Get in touch</h1>

<p class="mc-contact-email"><a href="mailto:mike@mcornelia.com">mike@mcornelia.com</a></p>

<p class="mc-contact-links">
  <a href="https://linkedin.com/in/mcornelia">LinkedIn</a>
  <span>·</span>
  <a href="https://github.com/mcornelia">GitHub</a>
</p>

</div>
```

---

## BLOG POST 1: What Commissioning a Data Center Region Actually Looks Like

*Create as a new Post (not Page). Title goes in the WordPress title field.*

**Title:** What Commissioning a Data Center Region Actually Looks Like

```html
<p>Most people think a data center is a building you plug servers into.</p>

<p>I just commissioned a new region from an empty building to production-ready in a matter of weeks — 2,063 server racks, receiving rates up to 750 racks per week, with a single-day record of 200.</p>

<p>Here's what "commissioning a data center region" actually means when you're doing it at hyperscale.</p>

<h2>It starts months before the first rack arrives</h2>

<p>Power infrastructure has to be energized, tested, and certified. Cooling systems — increasingly liquid cooling for AI workloads — have to be validated. Network fabrics have to be built and proven. Security, fire suppression, monitoring — all of it has to be operational before a single server touches the floor.</p>

<p>Then the racks start flowing. Hundreds per week. Every one has to be received, inspected, positioned, cabled, powered, tested, and handed to production. The logistics alone would rival a mid-size manufacturing operation.</p>

<h2>And you're not doing just one at a time</h2>

<p>Right now I'm managing 12+ concurrent projects across my region — permanent liquid-cooled facilities, rapid deployment structures, cable-connected expansions, and leased data centers. Each has its own construction timeline, commissioning sequence, and operational readiness checklist. Some are greenfield sites in new states. Some are expansions of campuses that are already running production traffic.</p>

<p>We're delivering 150 to 330 MW of new capacity every quarter. To put that in perspective, 300 MW is roughly enough to power a mid-size city.</p>

<p>Every quarter.</p>

<h2>The part that doesn't get talked about enough: people</h2>

<p>You can build the most advanced data center on earth, but if you don't have the right team ready on day one — trained, organized, and operating with clear standards — it doesn't matter. Workforce planning for new regions starts months before the building is done. Staffing models, training programs, operational playbooks, local government relationships, community engagement — all of it has to be in place before you take your first rack.</p>

<p>I've been doing this across 14 campuses in six states for the past eight years. Every region turn-up teaches you something the last one didn't.</p>

<p>The most important lesson? The building is the easy part. The operation is what makes it work.</p>
```

---

## BLOG POST 2: I Use AI Every Day to Do My Job Better

**Title:** I Run Data Center Operations for One of the Largest AI Fleets in the World. I Also Use AI Every Day.

```html
<p>Most executives at my level talk about AI strategy in meetings and then go back to spreadsheets and slide decks. I went the other direction — I actually built AI into how I work.</p>

<h2>I don't prepare for meetings the old way anymore</h2>

<p>When I walk into a legislative briefing at a state capitol, I've already had an AI agent research every legislator I'll meet — their voting history, committee assignments, public statements, and where they stand on the issues that affect my sites. What used to take a policy team days to compile, I have in an hour.</p>

<p>When I prep for an executive review, I have an AI agent pull operational data across my 14-site region, identify trends, flag anomalies, and draft the narrative. I still make every call. But I'm making those calls with better information, faster.</p>

<h2>I model scenarios in minutes, not days</h2>

<p>Workforce planning at gigawatt scale is genuinely hard. How many technicians do you need for a site that will grow from 500 MW to 2 GW over five years? What's the crossover point where insourcing beats contingent labor? What happens to your staffing model if diagnostic accuracy improves by 10%?</p>

<p>I used to wait for analysts to run these models. Now I describe the scenario to an AI agent, feed it the constraints, and iterate in real time. The quality of the output depends entirely on the quality of my thinking — the AI just removes the friction between having an idea and testing it.</p>

<h2>I use AI to improve how my teams use AI</h2>

<p>I sponsor AI initiatives across our operations organization — automated repair systems, troubleshooting agents that work alongside technicians, LLM-powered quality scoring of repair tickets. But I don't just govern these programs from a distance. Because I use AI tools daily, I have real intuition for what works, what doesn't, and where the failure modes are.</p>

<p>When someone proposes an agentic AI system for automated server repair, I can pressure-test it because I understand how these tools actually behave — the hallucinations, the edge cases, the places where human judgment is still irreplaceable.</p>

<h2>What I've learned</h2>

<p><strong>AI doesn't replace judgment — it compresses the time between question and answer.</strong> The hard part was never the analysis. It was getting the right information assembled fast enough to make timely decisions.</p>

<p><strong>Most leaders are delegating AI to their teams instead of using it themselves.</strong> That's backwards. The person with the most context should be the one interacting with the AI.</p>

<p><strong>Fluency compounds.</strong> Every week I use these tools, I get better at knowing what to ask, how to structure problems, and where to trust vs. verify. Leaders who wait to adopt are falling behind in ways they can't see yet.</p>

<p><strong>The next generation of operations leaders will be AI-native.</strong> Not AI-curious. Not AI-aware. Native.</p>

<p>The gap between leaders who adopt AI tools and leaders who delegate them is going to be the defining career differentiator of the next five years.</p>
```

---

## BLOG POST 3: The Workforce Problem Nobody Talks About

**Title:** The Workforce Problem Nobody Talks About in Data Center Operations

```html
<p>The data center industry has a math problem nobody wants to talk about.</p>

<p>We're building capacity at a pace the world has never seen. Gigawatt-scale campuses. Hundreds of megawatts coming online every quarter. New regions spinning up across the country to feed demand for AI training and inference.</p>

<p>But here's the question I don't hear enough people asking: where are all the people going to come from?</p>

<h2>You can't just hire your way to gigawatt scale</h2>

<p>I manage a region that's scaling from 900 MW to 2,500 MW in two years. If I staffed that growth linearly — same ratio of technicians per megawatt — I'd need to nearly triple my workforce. In a labor market where experienced data center technicians are already in short supply. In regions where we're competing with every other hyperscaler, colo provider, and AI startup for the same talent pool.</p>

<p>Linear scaling doesn't work. The industry needs a fundamentally different approach.</p>

<h2>The insourcing vs. contingent question is more complicated than people think</h2>

<p>Most large data center operators run a mix of full-time employees and contingent workers. The easy assumption is that FTEs are always better — more loyalty, more institutional knowledge, more control. But the economics are nuanced, especially at scale.</p>

<p>I've built staffing models for gigawatt-class sites that project headcount requirements through 2030, broken down by 500 MW increments. The crossover point where insourcing clearly wins depends on site maturity, workload mix, attrition rates, and training investment. It's not a simple answer, and anyone who tells you it is hasn't modeled it.</p>

<h2>The real unlock is reducing the work, not just filling the seats</h2>

<p>The single biggest lever for workforce sustainability isn't recruiting — it's diagnostic accuracy.</p>

<p>When a technician misdiagnoses a server issue, you get a repeat repair. That repeat visit consumes labor hours, delays the machine's return to production, and in aggregate, drives up your headcount requirements. Improve diagnostic accuracy by even a few percentage points across a fleet of hundreds of thousands of machines, and you measurably bend the hiring curve.</p>

<p>This is where AI becomes a workforce strategy, not just a technology initiative:</p>

<ul>
  <li>LLM-powered quality scoring catches diagnostic errors faster and feeds targeted training</li>
  <li>AI troubleshooting agents suggest next steps and flag likely root causes, improving first-time fix rates</li>
  <li>Agentic systems handle routine diagnostics autonomously, freeing skilled technicians for complex work</li>
</ul>

<p>None of these replace technicians. All of them make each technician more effective — which is the only sustainable path when you're adding hundreds of megawatts a quarter.</p>

<h2>The bottom line</h2>

<p>The data center industry is in an arms race for capacity. Everyone is talking about power, cooling, and construction timelines. Almost nobody is talking about whether the workforce model can actually scale to match.</p>

<p>The winners won't be the ones who build the most megawatts. They'll be the ones who figured out how to operate them without linearly scaling headcount.</p>
```
