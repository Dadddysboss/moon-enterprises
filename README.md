# Moon Enterprises - Talent Portfolio Web Application

A static, fully responsive talent portfolio web application for Moon Enterprises. Built with vanilla HTML5, CSS3, and ES6+ JavaScript — no build step, no framework dependencies, no CMS.

## Live Features

- **Static JSON Binding** — Content is rendered from `data.json` via `fetch()`. No backend, no database.
- **Bilingual Toggle (EN / UR)** — Sticky header switcher swaps every string. Urdu mode applies `dir="rtl"` and a Nastaliq-friendly font stack.
- **Dynamic WhatsApp Integration** — Clicking any leadership or model card opens `https://wa.me/923147553161?text=…` with model name, specialty, and price pre-filled.
- **Responsive Grid** — Mobile-first CSS Grid that adapts from 1 to 4+ columns across breakpoints.
- **Image Fallback System** — If a model image is missing, an SVG initials avatar is rendered instead.
- **Accessibility** — Keyboard-navigable cards, ARIA labels, focus styles, reduced-motion support.

## Project Structure

```
Moon Enterprises/
├── index.html              # Main HTML file
├── style.css               # All styles (CSS variables, responsive, RTL-aware)
├── script.js               # All JavaScript (ES6+ IIFE module pattern)
├── data.json               # Static data source
├── vercel.json             # Vercel deployment config
├── README.md               # This file
└── assets/
    └── images/             # Local image assets (place here before deploy)
        ├── maqbool_moon_father.jpg
        ├── moon manager.jpeg
        ├── ayesha.jpg
        ├── kinza.jpg
        ├── kainat.jpg
        ├── malaika.jpg
        ├── peeno.jpg
        ├── bushra.jpg
        ├── chanda.jpg
        ├── dani_daniels.jpg
        ├── mia_khalifa.jpg
        └── mia_malkova.jpg
```

## Setup

### 1. Local Development

No build step required. Open `index.html` directly, or use a simple static server:

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node (if installed)
npx serve

# Option 3: PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

> Note: `data.json` is loaded via `fetch()`, so you must serve the files via HTTP — opening `index.html` directly with `file://` will fail due to CORS restrictions on local files.

### 2. Add Images

Place all 12 image files into `assets/images/` with the exact filenames listed in the project structure above. The filenames are mapped 1:1 with entries in `data.json`.

### 3. Deploy to Vercel

#### Option A: Vercel CLI

```bash
npm i -g vercel
cd "Moon Enterprises"
vercel
```

Follow the prompts. The `vercel.json` already includes the static-build configuration.

#### Option B: Git Integration

1. Push the project to a Git repository (GitHub, GitLab, Bitbucket).
2. Import the repository in the [Vercel dashboard](https://vercel.com/new).
3. Vercel will auto-detect it as a static site. No build command needed.

#### Option C: Drag & Drop

1. Zip the project folder (excluding `node_modules` if any).
2. Drag the folder onto the Vercel dashboard's "New Project" page.

## Configuration

### WhatsApp Number

To change the WhatsApp number, edit the `WHATSAPP_NUMBER` constant at the top of `script.js`:

```js
const WHATSAPP_NUMBER = '923147553161';
```

The format must be the international dialing code + number, with no `+` or spaces.

### Bilingual Strings

All UI text is in the `I18N_STRINGS` object at the top of `script.js`. To add a new language, add a new key (e.g., `ar`) with the matching string map and update the `toggleLanguage` function.

### Model Data

Edit `data.json` to add/remove/change models. Each model requires:
- `id` (unique integer)
- `name`
- `specialty` (bilingual: `"English / اردو"`)
- `bio` (bilingual: `"English / اردو"`)
- `pricing` (e.g., `"PKR 5,000 / Session"`)
- `image` (path relative to root)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, Grid, Flexbox, container queries-ready) |
| Behavior | Vanilla JavaScript ES6+ (IIFE module pattern, no bundler) |
| Icons | FontAwesome 6.5 (CDN) |
| Data | Static JSON |
| Hosting | Vercel Static |

## Browser Support

- Chrome / Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari iOS 14+
- Chrome Android 90+

## License

Proprietary — © 2026 Moon Enterprises.
