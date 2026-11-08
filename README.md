# A Sky Full of Peace

A small, anonymous Diwali gift. One heavy feeling at a time waits on a launch
pad at the bottom of a night sky. She taps it, watches it rise and burst into a
massive, colourful firework, and the next one takes its place. When all of them
are gone the sky answers with a firework show and a quiet wish.

Nothing is asked of her. There are no forms, links, names, replies, analytics
or network calls.

## The experience

1. **Welcome.** A drifting star field, golden dust, a small diya, and
   "A Sky Full of Peace". Tapping "Enter my sky" also switches on the firework
   sounds (browsers only allow sound after a tap).
2. **The launch pad.** One glowing shell sits in its tube at the bottom of the
   screen, with its word above it: Heavy days, Worries, Broken trust, Old
   wounds, Feeling alone, Overthinking, Fear or Disappointment, in a new random
   order each visit. A tap fires it: the shell leaps from its tube, a rocket
   climbs with a sparkling tail, and it bursts across most of the sky in its
   own colours and shape. About half a second later the next word rises into
   place, so she can keep going quickly and several fireworks can share the
   sky. Small dots show how many are still waiting.
3. **The show.** When the last one has burst, an 18-second show plays on its
   own: an opening pair, a golden crown, tilted rings, a fan of crossettes, a
   golden palm, a rainbow chain, a barrage, and a golden willow finale.
4. **The wish.** While the golden rain is still falling, the stars brighten,
   golden lights drift in, and "A wish for you ✨" appears line by line. "Light
   the sky again" sets the launch pad up afresh.

## Run it locally

Requires Node.js 22.12 or newer (built and tested with Node 22.20.0, npm 10.9.3).

```bash
npm ci
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run typecheck` | TypeScript checks for app, tests and config |
| `npm test` | Unit and component tests (Vitest + Testing Library) |
| `npm run build` | Production build into `dist/` |
| `npm run validate:pages` | Checks every path in `dist/` resolves under `BASE_PATH`, and prints real file sizes |
| `npm run verify` | All of the above, in order |
| `npm run preview` | Serves the production build locally |

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` type-checks, tests, builds,
validates the paths and deploys on every push to `main`.

1. Create a repository on GitHub. On a free plan, Pages needs a public
   repository. Anyone with the link can open the site either way; it is marked
   `noindex` so search engines leave it alone.
2. Push this folder to the `main` branch:

   ```bash
   git init
   ```

   ```bash
   git add .
   ```

   ```bash
   git commit -m "A Sky Full of Peace"
   ```

   ```bash
   git branch -M main
   ```

   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   ```

   ```bash
   git push -u origin main
   ```

3. In the repository go to **Settings → Pages → Build and deployment** and set
   **Source** to **GitHub Actions**.
4. Open the **Actions** tab. When "Deploy to GitHub Pages" finishes, the site
   address is shown on the run's `deploy` job (and under **Settings → Pages**).
   If the first run started before step 3, re-run it.

### Base path: project URL or custom domain

You do not need to configure this. `actions/configure-pages` reports the site's
base path and the workflow passes it to Vite as `BASE_PATH`:

| Site | Address | Base used |
| --- | --- | --- |
| Project site | `https://<you>.github.io/<repo>/` | `/<repo>/` |
| User site (`<you>.github.io` repo) | `https://<you>.github.io/` | `/` |
| Custom domain | `https://example.com/` | `/` |

For a custom domain, set it under **Settings → Pages → Custom domain**, add the
DNS records GitHub shows you, tick **Enforce HTTPS**, then re-run the workflow
so the next build uses `/`. A `CNAME` file is not needed with Actions deployments.

To build for another host, set the base yourself (`config/base.ts` explains the rules):

```bash
BASE_PATH=/some/folder/ npm run build
```

`BASE_PATH=./` produces a fully relative build that works from any folder.

## Project structure

```
src/
  app/          App.tsx: scene flow, engine and sound wiring
  components/   Welcome, launch pad (LaunchShell), show, wish, canvas host
  engine/       Canvas 2D fireworks engine (no React inside)
    lifecycle.ts    IDLE → SELECTED → IGNITION → LAUNCH → EXPLOSION → FADE → MESSAGE
    patterns.ts     Peony, chrysanthemum, willow, starburst, heart, ring, crossette, palm
    show.ts         The closing show programme
    particles.ts    Fixed-size particle pool (typed arrays, hard limit)
    simulation.ts   Launches, bursts, sky glow, smoke, the show
    ambience.ts     Stars, golden dust, the wish's golden lights
    renderer.ts     Drawing, glow sprites, motion streaks, fading trails
    SkyEngine.ts    requestAnimationFrame loop, DPR scaling, resize, visibility
  audio/        Firework sounds (sfx.ts) and the player (FireworkAudio.ts)
  content/      All words, the eight feelings, and their shuffle
  hooks/        Reduced motion, engine events, focus
  styles/       Tokens, base, sky, buttons, scenes
config/         Base-path resolution for Vite (and its tests)
scripts/        GitHub Pages path validator
public/images/  Favicon
.github/workflows/deploy.yml
```

## How it works

**Fireworks.** Two stacked canvases sit behind the page: one for the sky
(stars, golden lights, the glow each burst casts, drifting smoke) and one for
the fireworks, faded a little each frame so stars leave trails. Real shell
types are modelled: peonies with a contrasting inner core and colour-changing
stars, chrysanthemums dragging golden spark tails, golden willow rain that
hangs and glitters, tilted rings, crossettes that split into crosses, palms,
starbursts and an abstract heart. Stars fly on a 3D sphere with air drag and
gravity, and fast stars are drawn as motion streaks. Her fireworks are
massive (about 0.6 of the screen's short side in radius, with 1.5× the stars,
bigger and longer-lived); the show's shells are a little smaller so a barrage
still reads clearly. Sizes live at the top of `src/engine/simulation.ts`. React never re-renders per
frame. Particles live in a fixed pool (7,000 on desktop, 4,200 on phones and
low-core devices), device pixel ratio is capped at 2 and drops to 1.25 with
fewer stars if frames stay slow for 3 seconds, and the loop stops while the tab
is hidden.

**Sound.** Only the fireworks make sound; there is no music. Everything is
synthesised with Web Audio: a soft lift thump and a rising hiss for each
launch; for each burst, a sharp crack, a deep boom that arrives a moment after
the light (as it does outdoors), an echo, and crackle for glittering shells. A
limiter keeps a full barrage from distorting. Sound starts on the first tap; if
the browser blocks it or Web Audio is missing, the fireworks continue silently.
On iPhone the ring/silent switch also silences web audio.

**Accessibility.**
- Honors `prefers-reduced-motion`: fireworks bloom slowly in place with no
  rising rockets, nothing trails or splits, the show is shorter, and the page
  only fades.
- The shell is a real button, reachable by keyboard; after each launch, focus
  moves to the next word. A screen-reader status line announces each launch
  and the show. Canvases are hidden from screen readers; all words are real text.
- No hard flashes: bursts swell in softly and the sky glow stays faint; star
  shimmer stays under 2 Hz.
- Touch targets are at least 44×44 px. Text contrast meets WCAG AA on the sky.
- There is no sound or pause button, by request. Reduced motion is the way to
  calm the animation, and the device's volume controls the sound.

**Privacy and safety.** Everything loads from the same origin, with fonts
self-hosted. The built page carries a strict Content-Security-Policy, a
`no-referrer` policy and `noindex`. No names or personal details appear anywhere.

## Making changes

- Words: `src/content/copy.ts`; the eight feelings: `src/content/feelings.ts`.
- Each feeling's burst shape and colours: `pattern` and `palette` in `feelings.ts`
  (colours in `src/engine/palettes.ts`).
- The closing show: `src/engine/show.ts` (times, positions, shapes, colours).
- Sound levels: `src/audio/sfx.ts`.
- To allow search engines, remove the `robots` meta tag in `index.html`.

## Tests

`npm test` runs 111 tests:

- **Lifecycle:** phase order, timing, large time steps, re-lighting, reduced-motion pass-through.
- **Simulation:** launching from the tapped shell, big bursts, all eight at
  once, no double launch, sky glow and smoke (bounded and cleared), particle
  limit under stress with full cleanup, crossette splitting, the full show
  programme and its single end signal, the shorter reduced-motion show, and
  the wish's sky.
- **Patterns and particle pool:** valid, bounded, deterministic bursts;
  colour changes, cores, trails and splits; calmer reduced-motion bursts;
  capacity and swap-removal.
- **Sound:** silent until a tap; resume() inside the tap; one sound graph;
  blocked, rejected and never-settling resume; no Web Audio; a failing sound;
  hidden tab.
- **App:** welcome without sound or pause buttons, one firework on the pad at
  a time, the next word arriving after a launch, every feeling once in a
  shuffled order, several in the sky together, no messages after bursts,
  sounds, keyboard focus, the show starting only after all eight, the wish,
  lighting the sky again, the no-canvas fallback, reduced motion, and that no
  links, forms or reply fields exist.
- **Content and config:** exact wording, no promises of cures or requests for
  replies, the shuffle, and base-path resolution.
