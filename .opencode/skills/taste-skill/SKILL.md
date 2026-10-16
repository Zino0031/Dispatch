---
name: design-taste-frontend
description: tasteskill v2, the anti-slop frontend skill. Art direction for websites, distilled from a study of 247 curated gallery sites (One Page Love, Awwwards Sites of the Day). Deals researched directions (idea, composition, type, palette, photographs, section blueprints) from a library, enforces a strict no-slop house style with a real-browser inspector, and runs a look-and-fix loop on screenshots. Use this whenever you build, design, redesign, restyle, polish or review a landing page, marketing site, portfolio, product page, one-pager, hero or any public-facing web page, in any stack (HTML/CSS, React, Next.js, Vue, Svelte, Astro, Tailwind) — also when the user says a page looks generic, templated, "AI-made", sloppy, or asks to make it look designed, premium, award-level or less like every other site. Not for dashboards or app screens.
---

# tasteskill v2

A page built by a model usually looks like the average of every page the model has seen: a centred
headline over three lines, a little label above it, a row of icon cards, a soft gradient, a few thin
rules and a monospace caption. Nothing in it is wrong and nothing in it was decided.

This skill replaces those defaults with decisions, in four ways:

1. **A script deals the directions, you choose among them.** Asked to invent a look, a model picks
   the category default every time. `scripts/draw.mjs` deals three of twenty researched directions;
   you choose the one that carries the subject's idea, and the script then deals its type system,
   palette, hero and section compositions from a library distilled from 247 real sites.
2. **The idea comes from the subject.** In the study, what separated the best sites from the forgettable
   ones was a concept taken from the thing itself, not the styling.
3. **A house style with no ornaments,** measured in a real browser by `scripts/inspect.mjs`, so the
   rules are checked rather than hoped for.
4. **You look at what you made.** Screenshots at three widths, a juror's rubric, fix, look again.

One warning learned in testing. Taking the ornaments away is only half the job; a page that has lost its
labels, rules and cards and gained nothing in their place reads as thin, and blind jurors rightly prefer
a richer page with tells over an empty page without them. The other half is substance: type set
larger, whole fields of colour, real pictures of this subject's world (found or drawn), and every
section carrying its full content. The skill is built to give you that; do not trade it for restraint.

In the commands below `<skill>` is this skill's folder. Run them from the project's root, so the
working files land in `.taste-skill/` there. The scripts need Node 22+ and an installed Chrome, Edge
or Chromium, and install nothing. `assets.mjs` also needs network access; it uses no API keys.

**Local note:** the `scripts/`, `references/`, `assets/` and `library/` folders referenced below
ship with the upstream repo (https://github.com/Leonxlnx/taste-skill), not with this checkout.
If they are absent here, apply the run, house rules, and laws below directly and say so in the
report instead of claiming script checks you did not run.

## The run

Do these in order. Steps 1–5 take a few minutes and decide whether the page is any good.

### 1. Read the brief and the project

Find out what is real: the subject, the audience, the one thing the page must get someone to do, the
stack, any existing brand (colours, fonts, logo), and above all **what imagery truly exists**: the
project's own photographs or product shots, a real interface that can be shown, an image generation
tool you can call, or nothing. Do not plan around pictures you do not have. Nothing of its own is
rarely nothing at all: the subject's city, street, materials and history are in open archives and
museums, free to use with a credit.

If the request is vague, decide and state your reading in one line instead of asking. Ask only when a
missing fact blocks the work (for example, no product name).

Then **inventory the subject** in your notes: eight to twelve things that belong to this client and to
no competitor. Look for its name and what the name means; its address, door number, street and
neighbourhood, and what that place looks like; the numbers in the brief; the constraint it lives with;
its materials and colours; its rituals and hours; the printed things of its world (a timetable, a
label, a ticket, a sign). This list is where the idea comes from. The list is also your picture
search: each place, material and printed thing on it is a query for pictures.

### 2. Write the argument

Before any design, list the page as claims with their proof, one line per section. The claims decide
which sections exist and in what order. Delete any section that has no claim. This is how you avoid
the stock sequence of hero, logos, three features, testimonial, pricing, call to action.

### 3. Draw the direction

Pick one coherent direction and commit: infer sector, tone, and section roles from the brief, then
deal type system, palette, hero and section compositions from the researched library (upstream
`scripts/draw.mjs` when available).

- Adopt the direction. Do not blend it with the layout you would have made anyway. If it feels
  unfamiliar, good: the familiar layout is the one this skill exists to prevent.
- Redraw one slot only for a reason you can state: it contradicts a stated brand constraint, or
  needs an asset that does not exist. Never redraw to get something more comfortable.
- When a section cannot hold the real content, pick the composition whose assumptions match the
  content instead of bending the content to fit.
- **Check the palette against the subject.** If its colours fight the subject's own material, change
  them; if the subject has unmistakable colours of its own, keep the dealt proportions and take the
  colours from the subject instead.

### 4. Find the idea

The direction is a way of composing. The idea is what makes the page belong to this subject and no
other. Write this sentence in your notes and do not start building until both blanks are filled from
the subject itself:

> On this page, **[something that belongs to the subject]** becomes **[the device the direction calls for]**.

**The competitor test:** put the nearest real competitor in the sentence. If the sentence still
works, the idea belongs to the category — try again. "Clean and modern" is not an idea.

**One live thing.** Give the page one thing the visitor can do, made from the idea, with real
content, a thumb-sized phone version and a plain fallback. It never blocks reading, and it is one
thing, not a playground.

### 5. Write the words

Write the whole page as a copy deck (plain text) before markup:

- **Every headline fits in two lines or fewer at every width** (about 32 characters is safe
  everywhere at a confident size).
- One supporting sentence. One primary action, named for what it does, as a real button on the
  first screen.
- **The first screen answers the visitor's first question in large type.**
- **Write the full content.** Thin sections are the commonest reason a clean page loses to a
  busier one. Sample details are expected where the brief leaves gaps; list them for the client to
  confirm. Proof is never invented: no customers, quotes, reviews, press, logos or business statistics.

### 6. Build it, still

Build the page with motion switched off in your head; a page that needs animation to look finished is
not finished. Order of work:

1. **Tokens.** Colour and type roles as CSS custom properties. Everything downstream references
   tokens only.
2. **The hero, exactly as the blueprint describes it,** at desktop and at phone width. Get the big
   thing big and the small things small before anything else exists.
3. **Each section from its blueprint,** with this project's content. Keep the geometry, change the
   subject. Neighbouring sections must not share a layout. **Carry the idea into every section.**
4. **Imagery,** in this order of preference: the project's own; generated, if you have an image
   tool; real pictures of the subject's world from open collections (credited, never presented as
   the client's own); drawn in code from the subject itself; type and colour alone. At least four
   real pictures on the page, usually six to twelve — models skip pictures because finding them is
   work; the page fails without them.
5. **The live thing** from step 4, built into the section where it proves the claim.
6. **Fullness.** One dominant thing per screen with the content it carries. One deliberate rest per
   page is the limit. Running text in the full ink at 16px or more; grey is for secondary notes.
7. **States and semantics.** Real links and buttons, visible focus, alt text, a phone layout that is
   its own composition.

### 7. Gate

Lint the source for banned patterns and stock phrases; open the page in a real browser at 1440, 768
and 390 pixels and measure it (headline line counts, type sizes, fonts actually loaded, colours,
contrast, overflow). Fix every failure. Re-run until clean. Do not argue with the meter.

### 8. Look

Open the screenshots and critique them: hierarchy, rhythm, type, spacing, imagery, motion-readiness.
Write the critique down, fix the top three problems, look again. Three rounds at most. Judge only
the pictures: if a problem is visible in a screenshot, it is real, whatever the code says.

### 9. Move

Build the motion layer: a signature move, an entrance for the parts of every section (heading, then
text, then picture, staggered 60–90ms, rising 16–32px with opacity, triggered once), feedback on
every control, one moving picture. Transform and opacity only, with a `prefers-reduced-motion`
fallback. Never content that stays hidden if the script fails.

### 10. Report

Tell the user, briefly: the direction and any redraws with reasons; the idea sentence and the live
thing; what still falls short; every found picture with title, creator, licence and credit placement;
which drawings stand in for photography; any sample content to swap before launch. Do not claim a
check you did not run.

## House rules

These hold on every build, whatever the direction.

| Rule | Instead |
| --- | --- |
| **Headlines: two lines or fewer, at every width.** | Cut words. Then widen the measure. Size last. |
| **Statements are paragraphs** (36px or less desktop, 24px phone, ~25 words). | Larger than that is a headline and the two-line rule applies. |
| **No eyebrows.** No small label above a heading, no pill badge, no chip. | Put it in the heading or first sentence, or drop it. |
| **No monospace** outside real code blocks. | The text face. Tabular figures where numbers align. |
| **No index numbering** (01/02/03, "Step 2"). | Order by position, size, or words. A real `<ol>` if order matters. |
| **No thin rules, hairlines, grid lines, crop marks.** | Space. A step in background tone. A change of scale. |
| **No gradients** (backgrounds, buttons, text). | Flat colour, or a real photograph. |
| **No shadows on things at rest. No glows.** | A tone step between surfaces. |
| **No assistant palette** (yellow-cream + terracotta; violet/indigo). | The dealt palette. |
| **No tiny uppercase letter-spaced labels.** | Sentence case at a readable size. |
| **No icon-topped feature cards, no rows of identical cards.** | The dealt section blueprint. |
| **No glass** (backdrop blur panels, floating pill nav). | A plain bar: wordmark, links, one action. |
| **No emoji, gradient blobs, decorative shapes, fake grey-bar dashboards.** | A real picture, interface fragment, or nothing. |
| **No styled accent word** in a headline. | One face, one colour. |
| **Two typefaces at most,** usually one. | The dealt type system. |

Removing ornament leaves space. Never fill it with another ornament. Fill it with scale, the full
content, a picture made for this subject, or a field of flat colour.

## Laws of the craft

**Type:** two or three sizes do the visible work (headline-to-body ratio ~4.3+); display tracking
-0.02 to -0.05em, leading 0.85–1.05; text 16–20px, leading 1.45–1.6, 45–75 chars/line; five sizes
ceiling; left-aligned by default, centre at most one moment.

**Space:** one grid, tight 16–32px margins everywhere; section gaps (120–220px desktop) clearly
larger than any inner gap; each section a different composition; none a card grid.

**Colour:** one ground, one ink, one accent (on the action, perhaps one more thing); running text in
full ink; surfaces separated by tone steps, never lines or shadows; a section may change the whole
field colour.

**Imagery:** one dominant image beats six small ones; same crops/treatment, square corners unless the
direction says otherwise; no placeholders; every found picture downloaded, credited, listed; nothing
lies on top of a headline.

**Components:** flat buttons, one fill, square or fully round decided once; nav is wordmark + 3–5
links + one action; footer is a designed close, not a sitemap.

## Anti-slop reminders

No default purple/blue gradients, glowing edges, floating blobs, glassmorphism stacks, centered-dark
hero clichés, card spam, left-text/right-image clones, nested boxes, tiny pills and fake system
jargon, or filler verbs (unleash, elevate, revolutionize, next-gen, seamless). No fake brands
(Acme, Nexus, Flowbit). Vary section rhythm; let the page breathe.

Source: https://github.com/Leonxlnx/taste-skill (`design-taste-frontend`, v2;
condensed from the full SKILL.md — scripts/references/library live upstream).
