# MarketBuzz Rebrand Design

## Summary

Rebrand the application from "MarketSounding" to "MarketBuzz" and replace the current blue color scheme with one derived from the new bee/honeycomb logo. The wordmark renders "Market" in black (light mode) / off-white (dark mode) and "Buzz" in sky blue. The new logo file (`frontend/logo/Gemini_Generated_Image_m5ifbsm5ifbsm5if(1).png`) is copied to `frontend/public/` and wired in after the color changes.

---

## Color Palette

### Light Mode

| Token | Current | New | Notes |
|---|---|---|---|
| `--background` | `#ffffff` | `#f0f9ff` | Faint sky blue tint matching logo field |
| `--card` | `#ffffff` | `#ffffff` | Keep white for contrast |
| `--primary` | `#2563eb` | `#0ea5e9` | Sky blue (logo background color) |
| `--primary-foreground` | `#ffffff` | `#ffffff` | |
| `--secondary` | `#f1f5f9` | `#e0f2fe` | Pale sky blue |
| `--secondary-foreground` | `#0f172a` | `#0f172a` | |
| `--muted` | `#f8fafc` | `#f0f9ff` | |
| `--muted-foreground` | `#64748b` | `#64748b` | Unchanged |
| `--accent` | `#f97316` | `#f0a500` | Golden honeycomb yellow |
| `--accent-foreground` | `#ffffff` | `#0f172a` | Dark text on gold |
| `--border` | `#e2e8f0` | `#bae6fd` | Sky blue border |
| `--input` | `#e2e8f0` | `#bae6fd` | |
| `--ring` | `#2563eb` | `#0ea5e9` | |
| `--sidebar` | `#f8fafc` | `#f0f9ff` | |
| `--sidebar-primary` | `#2563eb` | `#0ea5e9` | |
| `--sidebar-accent` | `#f1f5f9` | `#e0f2fe` | |
| `--sidebar-border` | `#e2e8f0` | `#bae6fd` | |
| `--sidebar-ring` | `#2563eb` | `#0ea5e9` | |
| `--chart-1` (dovish) | `#2563eb` | `#0ea5e9` | |
| `--dovish` | `#2563eb` | `#0ea5e9` | |

Unchanged in light mode: `--foreground`, `--card-foreground`, `--popover`, `--popover-foreground`, `--destructive`, `--hawkish`, `--warning`, `--success`, chart-2 through chart-5.

### Dark Mode

| Token | Current | New | Notes |
|---|---|---|---|
| `--background` | `#0a0a0f` | `#060d14` | Deeper navy-black |
| `--card` | `#1a1a2e` | `#0c1a26` | Dark navy card |
| `--popover` | `#1a1a2e` | `#0c1a26` | |
| `--primary` | `#3b82f6` | `#0ea5e9` | Sky blue |
| `--secondary` | `#252540` | `#0c2a3e` | Dark navy |
| `--muted` | `#1a1a2e` | `#0c1a26` | |
| `--accent` | `#fb923c` | `#f0a500` | Golden honeycomb |
| `--accent-foreground` | `#ffffff` | `#0f172a` | Dark text on gold |
| `--border` | `#2a2a3e` | `#0c2a3e` | Dark navy border |
| `--input` | `#2a2a3e` | `#0c2a3e` | |
| `--ring` | `#3b82f6` | `#0ea5e9` | |
| `--dovish` | `#60a5fa` | `#38bdf8` | Brighter sky for dark bg |
| `--sidebar` | `#1a1a2e` | `#0c1a26` | |
| `--sidebar-primary` | `#3b82f6` | `#0ea5e9` | |
| `--sidebar-accent` | `#252540` | `#0c2a3e` | |
| `--sidebar-border` | `#2a2a3e` | `#0c2a3e` | |
| `--sidebar-ring` | `#3b82f6` | `#0ea5e9` | |
| `--chart-1` | `#3b82f6` | `#0ea5e9` | |

Unchanged in dark mode: `--foreground`, `--foreground` variants, `--destructive`, `--hawkish`, `--warning`, `--success`, chart-2 through chart-5.

---

## Wordmark / App Name

All occurrences of the string `"MarketSounding"` in user-visible text are replaced with a two-part span:

```tsx
<span className="text-foreground font-semibold">Market</span>
<span className="text-primary font-semibold">Buzz</span>
```

Where plain string context is required (alt text, `<title>`, aria labels, metadata), use `"MarketBuzz"` as a single string.

### Files with "MarketSounding" to update

- `frontend/src/app/layout.tsx` — page `<title>`
- `frontend/src/components/marketing/marketing-header.tsx` — logo link text
- `frontend/src/components/console/console-header.tsx` — logo link text
- `frontend/src/components/marketing/marketing-footer.tsx` — footer name + copyright
- `frontend/src/app/auth/login/page.tsx` — logo text + description copy
- `frontend/src/app/auth/register/page.tsx` — logo text
- `frontend/src/app/page.tsx` — hero body copy, feature descriptions
- `frontend/src/app/about/page.tsx` — body copy
- `frontend/src/components/jarrett-widget.tsx` — context strings, intro strings

---

## Logo

Source file: `frontend/logo/Gemini_Generated_Image_m5ifbsm5ifbsm5if(1).png` (bee/honeycomb design, sky blue background).

Copy it to `frontend/public/logo.png`, replacing the old radar logo. All existing `<Image src="/logo.png" ... />` references continue to work unchanged.

**This step is deferred** — do the color scheme and text rebrand first, then swap the logo once those are verified.

---

## Out of Scope

- No layout, spacing, typography, or component structure changes
- No changes to the hawkish/dovish semantic colors (red stays red)
- No changes to chart-2 through chart-5 palette
- The golden accent (`#f0a500`) is applied only to `--accent`; it is not used as a primary CTA color
