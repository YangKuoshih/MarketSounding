# MarketBuzz Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app from "MarketSounding" to "MarketBuzz" and replace the color scheme with one derived from the new bee/honeycomb logo (sky blue primary, golden accent, deeper navy dark mode).

**Architecture:** All color changes are isolated to CSS custom properties in `frontend/src/app/globals.css`. All text changes are string replacements across TSX/TS files. The wordmark in headers/footers/auth pages is split into a two-part `<span>` so "Market" renders in `text-foreground` and "Buzz" renders in `text-primary`. The logo file swap is done last.

**Tech Stack:** Next.js (App Router), Tailwind CSS v4 with CSS custom properties, TypeScript, shadcn/ui

---

## Files Modified

| File | What changes |
|---|---|
| `frontend/src/app/globals.css` | CSS token values for light and dark mode |
| `frontend/src/app/layout.tsx` | Page `<title>` metadata string |
| `frontend/src/components/marketing/marketing-header.tsx` | Wordmark span split |
| `frontend/src/components/console/console-header.tsx` | Wordmark span split |
| `frontend/src/components/marketing/marketing-footer.tsx` | Footer name + copyright string |
| `frontend/src/app/auth/login/page.tsx` | Wordmark span splits + description copy |
| `frontend/src/app/auth/register/page.tsx` | Wordmark span splits |
| `frontend/src/app/page.tsx` | Hero body copy |
| `frontend/src/app/about/page.tsx` | Body copy references |
| `frontend/src/components/jarrett-widget.tsx` | Context/intro strings |
| `frontend/public/logo.png` | Replaced with new bee/honeycomb logo (deferred, Task 6) |

---

### Task 1: Update CSS color tokens in globals.css

**Files:**
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Update light mode tokens**

In `frontend/src/app/globals.css`, replace the entire `:root { ... }` block with:

```css
:root {
  --background: #f0f9ff;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #0ea5e9;
  --primary-foreground: #ffffff;
  --secondary: #e0f2fe;
  --secondary-foreground: #0f172a;
  --muted: #f0f9ff;
  --muted-foreground: #64748b;
  --accent: #f0a500;
  --accent-foreground: #0f172a;
  --destructive: #ef4444;
  --border: #bae6fd;
  --input: #bae6fd;
  --ring: #0ea5e9;
  --hawkish: #dc2626;
  --dovish: #0ea5e9;
  --warning: #f59e0b;
  --success: #10b981;
  --chart-1: #0ea5e9;
  --chart-2: #dc2626;
  --chart-3: #10b981;
  --chart-4: #f97316;
  --chart-5: #6b7280;
  --radius: 0.5rem;
  --sidebar: #f0f9ff;
  --sidebar-foreground: #0f172a;
  --sidebar-primary: #0ea5e9;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #e0f2fe;
  --sidebar-accent-foreground: #0f172a;
  --sidebar-border: #bae6fd;
  --sidebar-ring: #0ea5e9;
}
```

- [ ] **Step 2: Update dark mode tokens**

Replace the entire `.dark { ... }` block with:

```css
.dark {
  --background: #060d14;
  --foreground: #e2e8f0;
  --card: #0c1a26;
  --card-foreground: #e2e8f0;
  --popover: #0c1a26;
  --popover-foreground: #e2e8f0;
  --primary: #0ea5e9;
  --primary-foreground: #ffffff;
  --secondary: #0c2a3e;
  --secondary-foreground: #e2e8f0;
  --muted: #0c1a26;
  --muted-foreground: #94a3b8;
  --accent: #f0a500;
  --accent-foreground: #0f172a;
  --destructive: #f87171;
  --border: #0c2a3e;
  --input: #0c2a3e;
  --ring: #0ea5e9;
  --hawkish: #f87171;
  --dovish: #38bdf8;
  --warning: #fbbf24;
  --success: #34d399;
  --chart-1: #0ea5e9;
  --chart-2: #f87171;
  --chart-3: #34d399;
  --chart-4: #fb923c;
  --chart-5: #9ca3af;
  --sidebar: #0c1a26;
  --sidebar-foreground: #e2e8f0;
  --sidebar-primary: #0ea5e9;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #0c2a3e;
  --sidebar-accent-foreground: #e2e8f0;
  --sidebar-border: #0c2a3e;
  --sidebar-ring: #0ea5e9;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat: rebrand color scheme to sky blue / navy derived from MarketBuzz logo"
```

---

### Task 2: Update page metadata and marketing header

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/components/marketing/marketing-header.tsx`

- [ ] **Step 1: Update page title in layout.tsx**

In `frontend/src/app/layout.tsx`, find:
```ts
title: "MarketSounding -- Multi-Agent Market Reaction Simulator",
```
Replace with:
```ts
title: "MarketBuzz -- Multi-Agent Market Reaction Simulator",
```

- [ ] **Step 2: Split wordmark in marketing-header.tsx**

In `frontend/src/components/marketing/marketing-header.tsx`, find:
```tsx
          <Image
            src="/logo.png"
            alt="MarketSounding"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="font-mono text-base font-semibold tracking-tight">
            MarketSounding
          </span>
```
Replace with:
```tsx
          <Image
            src="/logo.png"
            alt="MarketBuzz"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="font-mono text-base font-semibold tracking-tight">
            <span className="text-foreground">Market</span><span className="text-primary">Buzz</span>
          </span>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/layout.tsx frontend/src/components/marketing/marketing-header.tsx
git commit -m "feat: rebrand page title and marketing header to MarketBuzz"
```

---

### Task 3: Update console header and footer

**Files:**
- Modify: `frontend/src/components/console/console-header.tsx`
- Modify: `frontend/src/components/marketing/marketing-footer.tsx`

- [ ] **Step 1: Split wordmark in console-header.tsx**

In `frontend/src/components/console/console-header.tsx`, find:
```tsx
            <Image
              src="/logo.png"
              alt="MarketSounding"
              width={28}
              height={28}
              className="rounded"
            />
            <span className="font-mono text-sm font-semibold tracking-tight">
              MarketSounding
            </span>
```
Replace with:
```tsx
            <Image
              src="/logo.png"
              alt="MarketBuzz"
              width={28}
              height={28}
              className="rounded"
            />
            <span className="font-mono text-sm font-semibold tracking-tight">
              <span className="text-foreground">Market</span><span className="text-primary">Buzz</span>
            </span>
```

- [ ] **Step 2: Update footer**

In `frontend/src/components/marketing/marketing-footer.tsx`, replace all occurrences of `MarketSounding` with `MarketBuzz`.

To find them first, check the file — based on the grep there are two: one in the footer logo area and one in the copyright line `(c) 2026 MarketSounding -- v0.1.0`. Both become plain `MarketBuzz` strings (no span split needed since they're in plain text/footer contexts).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/console/console-header.tsx frontend/src/components/marketing/marketing-footer.tsx
git commit -m "feat: rebrand console header and footer to MarketBuzz"
```

---

### Task 4: Update auth pages

**Files:**
- Modify: `frontend/src/app/auth/login/page.tsx`
- Modify: `frontend/src/app/auth/register/page.tsx`

- [ ] **Step 1: Update login page wordmarks**

In `frontend/src/app/auth/login/page.tsx` there are two logo+wordmark blocks (one in the main panel, one in the decorative side panel). For each, find:

```tsx
          <Image src="/logo.png" alt="MarketSounding" width={36} height={36} className="rounded" />
          <span className="font-mono text-base font-semibold tracking-tight">MarketSounding</span>
```
Replace with:
```tsx
          <Image src="/logo.png" alt="MarketBuzz" width={36} height={36} className="rounded" />
          <span className="font-mono text-base font-semibold tracking-tight">
            <span className="text-foreground">Market</span><span className="text-primary">Buzz</span>
          </span>
```

And the smaller variant:
```tsx
            <Image src="/logo.png" alt="MarketSounding" width={28} height={28} className="rounded" />
            <span className="font-mono text-sm font-semibold">MarketSounding</span>
```
Replace with:
```tsx
            <Image src="/logo.png" alt="MarketBuzz" width={28} height={28} className="rounded" />
            <span className="font-mono text-sm font-semibold">
              <span className="text-foreground">Market</span><span className="text-primary">Buzz</span>
            </span>
```

Also update the description copy on line 64:
```tsx
              MarketSounding simulates how primary dealers react to market events —
```
Replace with:
```tsx
              MarketBuzz simulates how primary dealers react to market events —
```

- [ ] **Step 2: Update register page wordmarks**

In `frontend/src/app/auth/register/page.tsx`, apply the same two wordmark replacements as in the login page (same pattern, same two sizes). Replace `alt="MarketSounding"` with `alt="MarketBuzz"` and split both span texts.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/auth/login/page.tsx frontend/src/app/auth/register/page.tsx
git commit -m "feat: rebrand auth pages to MarketBuzz"
```

---

### Task 5: Update landing page, about page, and Jarrett widget

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/about/page.tsx`
- Modify: `frontend/src/components/jarrett-widget.tsx`

- [ ] **Step 1: Update landing page copy**

In `frontend/src/app/page.tsx`, find:
```tsx
                MarketSounding runs multi-round AI agent roundtables modeling how
                5 primary dealers react to market events -- watching consensus
                form, dissent emerge, and crises shift positions.
```
Replace with:
```tsx
                MarketBuzz runs multi-round AI agent roundtables modeling how
                5 primary dealers react to market events -- watching consensus
                form, dissent emerge, and crises shift positions.
```

- [ ] **Step 2: Update about page copy**

In `frontend/src/app/about/page.tsx`, replace all three occurrences of `MarketSounding` with `MarketBuzz`. They are in plain text paragraphs (lines ~186, ~212, ~372), so no span splitting needed — just string replacement.

- [ ] **Step 3: Update Jarrett widget strings**

In `frontend/src/components/jarrett-widget.tsx`, replace all occurrences of `MarketSounding` with `MarketBuzz`. These are JavaScript string literals used as AI context/intro prompts — plain string replacement throughout (lines ~21, ~56, ~63, ~64, ~68, ~69, ~70, ~391).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/app/about/page.tsx frontend/src/components/jarrett-widget.tsx
git commit -m "feat: rebrand landing page, about page, and Jarrett widget copy to MarketBuzz"
```

---

### Task 6: Swap logo file (deferred — do after verifying Tasks 1–5)

**Files:**
- Replace: `frontend/public/logo.png`

- [ ] **Step 1: Copy new logo into public/**

```bash
cp "frontend/logo/Gemini_Generated_Image_m5ifbsm5ifbsm5if(1).png" frontend/public/logo.png
```

All existing `<Image src="/logo.png" ... />` references pick it up automatically — no code changes needed.

- [ ] **Step 2: Verify logo renders**

Start the dev server (`cd frontend && npm run dev`) and visually confirm the new bee/honeycomb logo appears in the marketing header, console header, and auth pages.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/logo.png
git commit -m "feat: replace radar logo with new MarketBuzz bee/honeycomb logo"
```
