---
inclusion: fileMatch
fileMatchPattern: "**/*.tsx,**/components/**,**/app/**/*.tsx,**/app/**/*.css"
---

# UI/UX Design Standards â€” MarketSounding

## Design Philosophy

Create distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Every component should feel intentionally designed for a financial markets context â€” professional, data-dense, and visually striking.

## Aesthetic Direction

MarketSounding targets NY Fed Markets Group staff. The UI should feel:
- **Editorial/financial** â€” like a Bloomberg terminal meets a premium research publication
- **Data-dense but breathable** â€” generous whitespace around dense data tables
- **Dark-mode-first** â€” financial professionals work in low-light environments
- **Confident typography** â€” distinctive font pairings, not generic system fonts

## Critical Design Rules (Priority Order)

### 1. Accessibility (CRITICAL)
- Color contrast minimum 4.5:1 for normal text, 3:1 for large text
- Visible focus rings on all interactive elements (2-4px)
- aria-labels for icon-only buttons
- Keyboard navigation: tab order matches visual order
- Don't convey information by color alone (add icon/text)
- Respect prefers-reduced-motion

### 2. Touch & Interaction (CRITICAL)
- Minimum touch target 44Ã—44px
- Minimum 8px gap between touch targets
- Loading feedback on async operations (disable button + spinner)
- Clear error messages near the problem field
- cursor-pointer on all clickable elements

### 3. Typography & Color
- Base font size 16px minimum
- Line height 1.5 for body text
- Use CSS variables / Tailwind tokens for all colors â€” no raw hex in components
- Semantic color tokens (--primary, --muted, --destructive, etc.)
- Line length: 60-75 characters on desktop

### 4. Animation & Motion
- Duration 150-300ms for micro-interactions
- Use animation to convey meaning (state changes, data loading)
- Staggered reveals on page load for delight
- CSS-only where possible; Motion library for complex sequences
- Always provide reduced-motion alternatives

### 5. Layout & Responsive
- Mobile-first breakpoints (375 / 768 / 1024 / 1440)
- No horizontal scroll on mobile
- 4px/8px spacing scale (Tailwind's default)
- Reserve space for async content (skeleton screens, not spinners)

## MarketSounding-Specific Patterns

### Data Tables (Persona Reactions)
- Zebra striping or subtle row borders for scanability
- Right-align numeric columns (H/D score, confidence)
- Monospace or tabular-nums for numeric data
- Expandable rows with smooth height animation
- Sort indicators on clickable column headers

### Hawkish/Dovish Spectrum
- Color scale: deep blue (dovish) â†’ neutral gray â†’ deep red (hawkish)
- Persona markers positioned proportionally on the strip
- Labels at both ends, persona short names on markers
- Click-to-sort interaction clearly afforded

### Loading States
- Skeleton screens matching final layout shape
- Persona avatars with staggered "thinking" animation
- Progress indication (X of 5 personas complete)

### Disclaimer Banners
- Persistent, non-dismissible
- Amber/warning color scheme
- Compact (single line) to minimize visual weight
- Present on every page showing simulated content

## Anti-Patterns (NEVER DO)
- **EMOJIS** â€” absolutely zero emojis anywhere in the UI, code, or placeholders. Use Lucide icons.
- Generic purple gradients on white backgrounds
- Inter/Roboto/Arial as primary fonts
- Cookie-cutter card layouts with no hierarchy
- Placeholder-only form labels
- Gray-on-gray text
- Decorative-only animations with no purpose
- Mixing flat and skeuomorphic styles randomly
- Tremor charts â€” use D3.js for all data visualization
- Dark-mode-only design â€” must support both light and dark themes

## Tech Stack for UI
- **Framework**: Next.js 15 App Router + TypeScript
- **Styling**: Tailwind CSS with custom theme tokens (light + dark mode)
- **Components**: shadcn/ui as base primitives
- **Charts/Graphs**: D3.js for data visualizations (knowledge graph, position evolution, H/D spectrum)
- **Animations**: Framer Motion for UI micro-interactions (staggered reveals, loading states, transitions)
- **Icons**: Lucide React (SVG only â€” NO EMOJIS ANYWHERE, EVER)
- **Fonts**: Fira Code (data/monospace) + Fira Sans (UI text)
- **Theme**: Light + dark mode with system preference detection and manual toggle

## ABSOLUTE RULES (non-negotiable)
- **ZERO EMOJIS** in any UI, code comment, placeholder, or component. Use Lucide icons exclusively.
- **No Tremor** â€” use D3.js for all charts and data visualizations
- **Light + dark mode** â€” every component must work in both themes. Use CSS variables / Tailwind dark: prefix.
- **No generic fonts** â€” Fira Code + Fira Sans only (no Inter, Roboto, Arial, system-ui)
