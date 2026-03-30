# UI Refresh — Notion-Warm Design Spec

## Overview

Replace DesignForge's generic AI-generated visual style with a warm, professional aesthetic inspired by Notion. The key transformation is swapping cool gray Tailwind defaults for warm brown-tinted colors, muted accent palette, and subtle component styling that feels handcrafted rather than templated.

## Design Direction

**Notion-Warm**: Warm brown text (#37352F), off-white sidebar (#F7F6F3), muted accent colors, ultra-subtle borders, document-like content feel. Full dark mode support with warm dark tones.

## Design Tokens

Implemented as CSS custom properties in `globals.css`, referenced by Tailwind via `@theme` or utility classes. Every component references tokens — no raw Tailwind gray-* colors.

### Light Mode

```css
:root {
  --text-primary: #37352F;
  --text-secondary: rgba(55, 53, 47, 0.65);
  --text-tertiary: rgba(55, 53, 47, 0.4);
  --bg-page: #FFFFFF;
  --bg-sidebar: #F7F6F3;
  --bg-hover: rgba(55, 53, 47, 0.06);
  --bg-active: rgba(55, 53, 47, 0.1);
  --bg-code: rgb(247, 246, 243);
  --border-subtle: rgba(55, 53, 47, 0.09);
  --border-medium: rgba(55, 53, 47, 0.15);
  --accent: #337EA9;
  --accent-hover: #2B6A8E;
  --accent-bg: #E7F3F8;
  --success: #448361;
  --success-bg: #EDF3EC;
  --warning: #CB912F;
  --warning-bg: #FBF3DB;
  --danger: #D44C47;
  --danger-bg: #FDEBEC;
  --shadow-card-hover: rgba(15, 15, 15, 0.1) 0 0 0 1px, rgba(15, 15, 15, 0.1) 0 2px 4px;
}
```

### Dark Mode

```css
.dark {
  --text-primary: rgba(255, 255, 255, 0.9);
  --text-secondary: rgba(255, 255, 255, 0.5);
  --text-tertiary: rgba(255, 255, 255, 0.3);
  --bg-page: #191919;
  --bg-sidebar: #252525;
  --bg-hover: rgba(255, 255, 255, 0.06);
  --bg-active: rgba(255, 255, 255, 0.1);
  --bg-code: #2F2F2F;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-medium: rgba(255, 255, 255, 0.12);
  --accent: #529CCA;
  --accent-hover: #6BB0D6;
  --accent-bg: rgba(82, 156, 202, 0.15);
  --success: #4DAB9A;
  --success-bg: rgba(77, 171, 154, 0.15);
  --warning: #FFDC49;
  --warning-bg: rgba(255, 220, 73, 0.15);
  --danger: #FF7369;
  --danger-bg: rgba(255, 115, 105, 0.15);
  --shadow-card-hover: rgba(0, 0, 0, 0.3) 0 0 0 1px, rgba(0, 0, 0, 0.2) 0 2px 4px;
}
```

## Component Specs

### globals.css

- Define all CSS custom properties above
- Add Tailwind utility class mappings if needed
- Remove any hardcoded gray-* color overrides

### Header (`src/components/layout/Header.tsx`)

- Background: `var(--bg-page)`, no bottom border — differentiate from content via subtle elevation or just color
- Logo text: `var(--text-primary)` (#37352F warm brown)
- Nav links: `var(--text-secondary)` with `var(--bg-hover)` on hover
- Buttons: secondary style — no border, just text + hover tint
- Admin badge: muted orange `#D9730D` text on `#FAEBDD` background
- Height stays 64px (`h-16`)

### Sidebar (`src/components/layout/Sidebar.tsx`)

- Background: `var(--bg-sidebar)` (#F7F6F3 light, #252525 dark)
- NO border between sidebar and content area — differentiate by background color only
- Section headers: `11px`, uppercase, `var(--text-tertiary)`, `letter-spacing: 0.5px`
- Items: full-row clickable, `border-radius: 6px`, padding `5px 8px`
- Active item: `var(--bg-hover)` background, `var(--text-primary)` text
- Hover: `var(--bg-hover)` background
- Nested items: 16px left indent per level

### Project Cards (`src/components/project/ProjectCard.tsx`)

- Border: `1px solid var(--border-subtle)` — barely visible
- Border radius: `4px` (NOT `rounded-xl`)
- Shadow: none at rest
- Hover: `var(--shadow-card-hover)` — subtle lift with 1px outline + 2px shadow
- Background: `var(--bg-page)`
- Title: `var(--text-primary)`, 16px, font-weight 600
- Description: `var(--text-secondary)`, 14px
- Metadata: `var(--text-tertiary)`, 12px

### Design Cards (`src/components/design/DesignCard.tsx`)

- Same card treatment as project cards
- Status badges use muted Notion colors:
  - Draft: `#787774` text on `#F1F1EF` bg (light), `#979A9B` on `#454B4E` (dark)
  - In Review: `#CB912F` text on `#FBF3DB` bg (light), `#FFDC49` on `#59563B` (dark)
  - Approved: `#448361` text on `#EDF3EC` bg (light), `#4DAB9A` on `#354C4B` (dark)
- Badge border-radius: `3px` (not fully rounded)

### Design Viewer (`src/app/project/[projectId]/design/[designId]/page.tsx`)

- Toolbar: `var(--bg-page)` background, `var(--border-subtle)` bottom border
- Breadcrumb text: `var(--text-tertiary)`
- Design name: `var(--text-primary)`, font-weight 600
- Action buttons: secondary style — `var(--text-secondary)` text, `var(--bg-hover)` on hover, `4px` radius

### Buttons

| Variant | Light | Dark |
|---------|-------|------|
| Primary | `var(--accent)` bg, white text, `4px` radius | `var(--accent)` bg, white text |
| Secondary | No bg, `var(--text-secondary)` text, `var(--bg-hover)` on hover | Same with dark tokens |
| Destructive | `var(--danger)` bg, white text | `var(--danger)` bg |
| Ghost | No bg, no border, `var(--text-tertiary)`, hover tint | Same |

### Form Inputs

- Border: `var(--border-medium)`
- Border radius: `4px`
- Background: `var(--bg-page)`
- Focus: `var(--accent)` border, no ring/offset (simpler than current)
- Placeholder: `var(--text-tertiary)`

### Login / Register Pages

- Page background: `var(--bg-sidebar)` (#F7F6F3) — warm off-white
- Card: `var(--bg-page)` background, `var(--border-subtle)` border, `4px` radius
- Card shadow: subtle (`0 1px 3px rgba(15,15,15,0.04)`)
- Heading: `var(--text-primary)`, 24px, bold

### Dashboard Page

- Page background: `var(--bg-sidebar)` for the outer area
- Grid cards on `var(--bg-page)` background
- Grid: same `md:grid-cols-2 lg:grid-cols-3` but with muted card styling

### Admin Page

- Apply same token system to tabs, forms, history tables
- Tab active state: `var(--text-primary)` + bottom border in `var(--accent)`
- Tab inactive: `var(--text-tertiary)`

### Comment Sidebar & Pins

- Comment cards: `var(--bg-page)` background, `var(--border-subtle)` border
- Pin badges: `var(--accent)` background (dusty blue), white text
- Resolved badges: `var(--success)` background

### Related Designs Panel

- Same card styling as design cards
- Score badges: use accent palette
- Shared terms pills: `var(--bg-code)` background, `var(--text-secondary)` text

## Scope

### In Scope
- All CSS custom properties (tokens)
- All component files listed above
- Both light and dark mode
- Login, register, dashboard, project, design viewer, admin pages
- Header, sidebar, cards, buttons, forms, badges, comment components

### Out of Scope
- Font change (keep system fonts — a custom font adds load time and Notion's system stack is part of the aesthetic)
- Layout restructuring (keep existing page layouts, grid patterns)
- New components or features
- Markdown viewer styling (keep @tailwindcss/typography defaults)
- Image viewer (no changes)

## Contrast & Readability Requirements

Every text/background combination MUST pass WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text and UI components).

### Light Mode Contrast Checks

| Text | Background | Ratio | Pass? |
|------|-----------|-------|-------|
| `#37352F` on `#FFFFFF` | Primary text on page | 12.9:1 | Yes |
| `#37352F` on `#F7F6F3` | Primary text on sidebar | 11.4:1 | Yes |
| `rgba(55,53,47,0.65)` on `#FFFFFF` | Secondary text on page | ~6.5:1 | Yes |
| `rgba(55,53,47,0.4)` on `#FFFFFF` | Tertiary/placeholder | ~3.8:1 | Yes (large text / UI only) |
| `#448361` on `#EDF3EC` | Approved badge | ~4.2:1 | Yes |
| `#CB912F` on `#FBF3DB` | In Review badge | ~3.5:1 | Yes (large text threshold — badge is bold) |
| `#787774` on `#F1F1EF` | Draft badge | ~3.9:1 | Yes (UI component) |
| `#337EA9` on `#FFFFFF` | Accent links | ~5.2:1 | Yes |

### Dark Mode Contrast Checks

| Text | Background | Ratio | Pass? |
|------|-----------|-------|-------|
| `rgba(255,255,255,0.9)` on `#191919` | Primary text | ~15:1 | Yes |
| `rgba(255,255,255,0.9)` on `#252525` | Primary text on cards | ~12:1 | Yes |
| `rgba(255,255,255,0.5)` on `#191919` | Secondary text | ~7:1 | Yes |
| `rgba(255,255,255,0.3)` on `#191919` | Tertiary text | ~4:1 | Yes (UI only) |
| `#4DAB9A` on `rgba(77,171,154,0.15)` on `#252525` | Approved badge dark | ~5:1 | Yes |
| `#529CCA` on `#191919` | Accent links dark | ~6:1 | Yes |

### Form Input Specifics

| State | Light | Dark |
|-------|-------|------|
| Border (rest) | `rgba(55,53,47,0.15)` — visible warm gray | `rgba(255,255,255,0.12)` — visible on dark bg |
| Border (focus) | `#337EA9` solid, no ring | `#529CCA` solid, no ring |
| Background | `#FFFFFF` | `#252525` |
| Text | `#37352F` | `rgba(255,255,255,0.9)` |
| Placeholder | `rgba(55,53,47,0.4)` | `rgba(255,255,255,0.3)` |
| Disabled bg | `#F7F6F3` (off-white) | `#1F1F1F` (darker) |
| Disabled text | `rgba(55,53,47,0.3)` | `rgba(255,255,255,0.2)` |

### Textbox / Textarea / Select

All text inputs must:
- Have visible borders in both modes (current subtle borders disappear in some contexts)
- Show clear focus state without Tailwind's ring-offset pattern (use solid border color change)
- Maintain readable placeholder text in both modes
- Not inherit page background color — always use explicit input background

## Implementation Approach

1. **Start with globals.css** — add all CSS custom properties for both `:root` and `.dark`
2. **Create Tailwind utilities** — use `@layer utilities` or inline `var()` references
3. **Swap components top-down** — Header → Sidebar → Cards → Pages → Viewer → Admin
4. **Test each component in BOTH light and dark mode** after swapping — verify text is readable, inputs are visible, badges have sufficient contrast
5. **No functional changes** — purely visual, no logic changes
6. **Verify form inputs specifically** — login, register, admin forms, search, comment input all need testing in both modes
