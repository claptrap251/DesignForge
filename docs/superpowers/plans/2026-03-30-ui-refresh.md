# UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace DesignForge's generic visual style with a warm, Notion-inspired aesthetic — warm brown text, off-white backgrounds, muted accents, subtle shadows — across all components in both light and dark mode.

**Architecture:** CSS custom properties in globals.css define the entire palette. Components swap hardcoded Tailwind gray-* classes for inline `var()` references or mapped Tailwind utilities. No functional/logic changes — purely visual.

**Tech Stack:** Tailwind CSS v4, CSS custom properties, inline SVG (logo)

**Spec:** `docs/superpowers/specs/2026-03-30-ui-refresh-design.md`

---

## File Map

### Modified Files

| File | Change |
|------|--------|
| `src/app/globals.css` | Replace tokens, add warm palette for :root and .dark, update prose table colors |
| `src/components/layout/Header.tsx` | New logo SVG, warm colors, muted nav links |
| `src/components/layout/Sidebar.tsx` | Warm sidebar bg, section headers, item styles |
| `src/components/project/ProjectCard.tsx` | Warm card styling, muted badges, subtle hover shadow |
| `src/components/design/DesignCard.tsx` | Same card treatment, Notion-style status badges |
| `src/app/dashboard/page.tsx` | Warm page background, heading colors |
| `src/app/(auth)/login/page.tsx` | Warm off-white bg, card styling |
| `src/app/(auth)/register/page.tsx` | Same as login |
| `src/app/project/[projectId]/page.tsx` | Warm page bg, folder/sidebar colors |
| `src/app/project/[projectId]/design/[designId]/page.tsx` | Warm toolbar, breadcrumbs, action buttons |
| `src/components/comments/CommentSidebar.tsx` | Warm comment cards, pin badges |
| `src/components/design/RelatedDesigns.tsx` | Warm card styling, muted score badges |
| `src/app/admin/page.tsx` | Warm tab styling, form inputs, history tables |
| `src/app/settings/tokens/page.tsx` | Warm page bg, card styling, form inputs |
| `public/favicon.ico` | New logo favicon |

---

## Task 1: Design Tokens & globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the CSS custom properties**

In `src/app/globals.css`, replace the existing `:root` and `.dark` blocks (lines 6-14) and the `@theme inline` block (lines 16-19) with the full warm palette:

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
  --badge-draft: #787774;
  --badge-draft-bg: #F1F1EF;
  --badge-review: #CB912F;
  --badge-review-bg: #FBF3DB;
  --badge-approved: #448361;
  --badge-approved-bg: #EDF3EC;
  --admin-text: #D9730D;
  --admin-bg: #FAEBDD;
  --background: var(--bg-page);
  --foreground: var(--text-primary);
}

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
  --badge-draft: #979A9B;
  --badge-draft-bg: #454B4E;
  --badge-review: #FFDC49;
  --badge-review-bg: #59563B;
  --badge-approved: #4DAB9A;
  --badge-approved-bg: #354C4B;
  --admin-text: #FFA344;
  --admin-bg: rgba(255, 163, 68, 0.15);
  --background: var(--bg-page);
  --foreground: var(--text-primary);
}
```

Keep the `@theme inline` block but update it:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}
```

- [ ] **Step 2: Update prose table colors to warm palette**

Replace the prose table styles (lines 57-90) with warm versions:

```css
.prose th,
.prose td {
  border: 1px solid var(--border-medium);
  padding: 0.625rem 1rem;
  text-align: left;
  line-height: 1.625;
}

.prose th {
  background-color: var(--bg-sidebar);
  font-weight: 600;
}

.prose tbody tr:nth-child(even) {
  background-color: var(--bg-sidebar);
}
```

Remove the `.dark .prose` overrides — they're no longer needed since we use CSS variables.

- [ ] **Step 3: Update comment highlight colors**

Replace the comment highlight (lines 42-50):

```css
.has-comment-highlight {
  background-color: var(--warning-bg);
  border-radius: 0.25rem;
  transition: background-color 0.3s;
}
```

Remove the `.dark .has-comment-highlight` override.

- [ ] **Step 4: Update body font stack**

In the `body` rule (line 22-25), update to match Notion's stack:

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
}
```

- [ ] **Step 5: Verify in browser**

Open http://localhost:3000 in both light and dark mode. The base text color and backgrounds should already look warmer. Prose tables should use warm colors.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add Notion-warm design tokens to globals.css"
```

---

## Task 2: Logo & Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Replace the logo SVG and update all colors**

Read `src/components/layout/Header.tsx`. Replace the existing logo SVG (the indigo geometric shape) with the new minimalist "D" monogram. Update all color classes throughout the component to use CSS variables.

The new logo SVG (28x28):

```jsx
<svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  {/* D shape with folder tab */}
  <path d="M4 6C4 4.89543 4.89543 4 6 4H13L16 7H26C27.1046 7 28 7.89543 28 9V26C28 27.1046 27.1046 28 26 28H6C4.89543 28 4 27.1046 4 26V6Z" fill="var(--text-primary)" fillOpacity="0.85"/>
  {/* Wrench/tool accent */}
  <path d="M15 14L18.5 17.5M18.5 17.5L22 14M18.5 17.5V23" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx="12" cy="18" r="3" stroke="var(--accent)" strokeWidth="2" fill="none"/>
</svg>
```

Color changes for the entire Header component — replace all Tailwind gray/indigo classes:

| Current class | Replace with |
|--------------|-------------|
| `text-gray-900 dark:text-gray-100` | `style={{ color: 'var(--text-primary)' }}` |
| `text-gray-700 dark:text-gray-300` | `style={{ color: 'var(--text-secondary)' }}` |
| `text-gray-500 dark:text-gray-400` | `style={{ color: 'var(--text-tertiary)' }}` |
| `text-gray-600 dark:text-gray-400` | `style={{ color: 'var(--text-secondary)' }}` |
| `bg-white dark:bg-gray-800` | `style={{ backgroundColor: 'var(--bg-page)' }}` |
| `border-gray-200 dark:border-gray-700` | `style={{ borderColor: 'var(--border-subtle)' }}` |
| `hover:bg-gray-100 dark:hover:bg-gray-700` | Use `onMouseOver/onMouseOut` or CSS class with `var(--bg-hover)` |
| `border-orange-400 dark:border-orange-500` + orange text | `style={{ color: 'var(--admin-text)', backgroundColor: 'var(--admin-bg)' }}` with no border |
| `border-gray-300 dark:border-gray-600` on buttons | Remove borders on secondary buttons, just text + hover tint |
| `text-indigo-600` | `style={{ color: 'var(--accent)' }}` |

For hover states that need CSS variables, add a small CSS class in globals.css or use inline event handlers:

```tsx
// Pattern for hover with CSS variables:
<button
  className="rounded px-3 py-1.5 text-sm font-medium transition-colors"
  style={{ color: 'var(--text-secondary)' }}
  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
>
```

- [ ] **Step 2: Verify in browser**

Check header in both light and dark mode:
- Logo renders with warm brown shape + dusty blue accents
- "DesignForge" text is warm brown (light) / near-white (dark)
- Nav links are muted, hover shows warm tint
- Admin badge is muted orange
- Sign out is ghost style (no border)

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: update Header with new logo and warm color palette"
```

---

## Task 3: Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update sidebar colors**

Read `src/components/layout/Sidebar.tsx`. Apply these changes:

- Container background: `style={{ backgroundColor: 'var(--bg-sidebar)' }}`
- Remove any border-right between sidebar and content
- Section headers (like "Projects", "Folders"): add `text-[11px] uppercase tracking-wide` with `style={{ color: 'var(--text-tertiary)' }}`
- Sidebar items: `rounded-md` → `rounded-[6px]`, padding `py-1 px-2`
- Active item background: `style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' }}`
- Hover: `style={{ backgroundColor: 'var(--bg-hover)' }}`
- Inactive text: `style={{ color: 'var(--text-secondary)' }}`
- Remove all `dark:` class variants — CSS variables handle both modes

- [ ] **Step 2: Verify in browser**

Navigate to a project page. Check sidebar in both modes:
- Warm off-white background (light) / dark warm gray (dark)
- No hard border between sidebar and content
- Items show warm hover tint
- Active item is subtly highlighted

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: update Sidebar with warm palette and Notion-style items"
```

---

## Task 4: Project Cards & Dashboard

**Files:**
- Modify: `src/components/project/ProjectCard.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update ProjectCard**

Read `src/components/project/ProjectCard.tsx`. Apply:

- Card border: `style={{ border: '1px solid var(--border-subtle)', borderRadius: '4px', backgroundColor: 'var(--bg-page)' }}`
- Remove `shadow-sm` — no shadow at rest
- Hover shadow: `onMouseOver` sets `boxShadow: 'var(--shadow-card-hover)'`, `onMouseOut` clears it
- Title: `style={{ color: 'var(--text-primary)' }}`, font-weight 600
- Description: `style={{ color: 'var(--text-secondary)' }}`
- Metadata (dates, counts): `style={{ color: 'var(--text-tertiary)' }}`
- Remove all `dark:` class variants

- [ ] **Step 2: Update Dashboard page**

Read `src/app/dashboard/page.tsx`. Apply:

- Page background: `style={{ backgroundColor: 'var(--bg-sidebar)' }}` (the warm off-white — cards pop against it)
- Page heading: `style={{ color: 'var(--text-primary)' }}`
- Subtext: `style={{ color: 'var(--text-secondary)' }}`
- "New Project" button/card: dashed border `2px dashed var(--border-medium)`, warm tint on hover
- Remove all `dark:bg-gray-*`, `dark:text-gray-*` class variants

- [ ] **Step 3: Verify in browser**

Check dashboard in both modes:
- Warm cream background with white cards on top
- Cards have barely-visible borders, subtle lift on hover
- Text hierarchy is clear (primary → secondary → tertiary)

- [ ] **Step 4: Commit**

```bash
git add src/components/project/ProjectCard.tsx src/app/dashboard/page.tsx
git commit -m "feat: update ProjectCard and Dashboard with warm palette"
```

---

## Task 5: Design Cards & Status Badges

**Files:**
- Modify: `src/components/design/DesignCard.tsx`

- [ ] **Step 1: Update DesignCard**

Read `src/components/design/DesignCard.tsx`. Apply same card treatment as ProjectCard, plus status badge colors:

- Card: same border/shadow/radius treatment as Task 4
- Status badges — replace the Tailwind color classes with CSS variables:

```tsx
// Status badge styles
const statusStyles = {
  DRAFT: { color: 'var(--badge-draft)', backgroundColor: 'var(--badge-draft-bg)' },
  IN_REVIEW: { color: 'var(--badge-review)', backgroundColor: 'var(--badge-review-bg)' },
  APPROVED: { color: 'var(--badge-approved)', backgroundColor: 'var(--badge-approved-bg)' },
};
```

- Badge border-radius: `3px` (not `rounded-full`)
- Design name: `style={{ color: 'var(--text-primary)' }}`
- Type label: `style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-code)' }}`
- Remove all `dark:` class variants

- [ ] **Step 2: Verify in browser**

Navigate to a project with designs. Check both modes:
- Muted status badges (warm green, amber, gray)
- Cards match project card styling
- Badges are `3px` radius, not pills

- [ ] **Step 3: Commit**

```bash
git add src/components/design/DesignCard.tsx
git commit -m "feat: update DesignCard with warm palette and Notion-style badges"
```

---

## Task 6: Login & Register Pages

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Update Login page**

Read `src/app/(auth)/login/page.tsx`. Apply:

- Page background: `style={{ backgroundColor: 'var(--bg-sidebar)' }}` (warm off-white)
- Card container: `style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-subtle)', borderRadius: '4px', boxShadow: '0 1px 3px rgba(15,15,15,0.04)' }}`
- Heading: `style={{ color: 'var(--text-primary)' }}`
- Labels: `style={{ color: 'var(--text-secondary)' }}`
- Inputs: `style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-medium)', color: 'var(--text-primary)', borderRadius: '4px' }}`
- Input focus: replace `focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2` with `focus:outline-none` and `onFocus` setting `borderColor: 'var(--accent)'`
- Primary button: `style={{ backgroundColor: 'var(--accent)', borderRadius: '4px' }}`
- Links: `style={{ color: 'var(--accent)' }}`
- Remove all `dark:` class variants

- [ ] **Step 2: Update Register page**

Read `src/app/(auth)/register/page.tsx`. Apply the same changes as login page.

- [ ] **Step 3: Verify in browser**

Check both pages in both modes:
- Warm off-white page background
- Card has subtle border and shadow
- Inputs have visible borders in both modes
- Focus shows blue border, no ring
- Placeholder text is readable

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/login/page.tsx" "src/app/(auth)/register/page.tsx"
git commit -m "feat: update Login and Register pages with warm palette"
```

---

## Task 7: Design Viewer & Toolbar

**Files:**
- Modify: `src/app/project/[projectId]/design/[designId]/page.tsx`

- [ ] **Step 1: Update the design viewer page**

Read the file. This is large — focus on color classes only, do NOT change any logic. Key areas:

- Toolbar background: `style={{ backgroundColor: 'var(--bg-page)', borderBottom: '1px solid var(--border-subtle)' }}`
- Breadcrumb text: `style={{ color: 'var(--text-tertiary)' }}`
- Design name `<h2>`: `style={{ color: 'var(--text-primary)' }}`
- Status badge: use the `statusStyles` object pattern from Task 5
- Action buttons (Edit, New Version, Export): ghost/secondary style with `var(--text-secondary)` and `var(--bg-hover)` on hover
- Remove all `dark:bg-gray-*`, `dark:text-gray-*`, `dark:border-gray-*` class variants from the toolbar and chrome areas

**Important:** Do NOT change the markdown content area or image viewer styling — only the chrome/toolbar/buttons around it.

- [ ] **Step 2: Verify in browser**

Open a design in both modes:
- Warm toolbar with subtle bottom border
- Breadcrumbs are muted tertiary text
- Buttons are ghost style, show warm hover tint
- Status badge uses muted Notion colors

- [ ] **Step 3: Commit**

```bash
git add "src/app/project/[projectId]/design/[designId]/page.tsx"
git commit -m "feat: update design viewer toolbar with warm palette"
```

---

## Task 8: Comments, Related Designs, Project Page

**Files:**
- Modify: `src/components/comments/CommentSidebar.tsx`
- Modify: `src/components/design/RelatedDesigns.tsx`
- Modify: `src/app/project/[projectId]/page.tsx`

- [ ] **Step 1: Update CommentSidebar**

Read `src/components/comments/CommentSidebar.tsx`. Apply:

- Comment card backgrounds: `var(--bg-page)`, borders `var(--border-subtle)`
- Pin number badges: `style={{ backgroundColor: 'var(--accent)', color: 'white' }}`
- Resolved badges: `style={{ backgroundColor: 'var(--success)', color: 'white' }}`
- Author name: `var(--text-primary)`
- Comment text: `var(--text-primary)`
- Timestamps: `var(--text-tertiary)`
- Remove all `dark:` variants

- [ ] **Step 2: Update RelatedDesigns**

Read `src/components/design/RelatedDesigns.tsx`. Apply:

- Card borders: `var(--border-subtle)`, radius `4px`
- Card hover: `var(--shadow-card-hover)`
- Score badges: use `var(--accent)` for high scores, `var(--text-tertiary)` for low
- Shared term pills: `style={{ backgroundColor: 'var(--bg-code)', color: 'var(--text-secondary)' }}`
- Similarity bar: `var(--accent)` fill
- Folder path text: `var(--text-tertiary)`
- Remove all `dark:` variants

- [ ] **Step 3: Update Project page**

Read `src/app/project/[projectId]/page.tsx`. Apply:

- Page background: `var(--bg-sidebar)` for the outer area
- Content panels: `var(--bg-page)` background
- Headings: `var(--text-primary)`
- Folder names: `var(--text-secondary)`, active `var(--text-primary)`
- Remove all `dark:` variants on color-related classes

- [ ] **Step 4: Verify in browser**

Check in both modes:
- Comments have warm styling
- Related panel matches card design
- Project page has warm background with content panels on top

- [ ] **Step 5: Commit**

```bash
git add src/components/comments/CommentSidebar.tsx src/components/design/RelatedDesigns.tsx "src/app/project/[projectId]/page.tsx"
git commit -m "feat: update Comments, Related Designs, and Project page with warm palette"
```

---

## Task 9: Admin & Settings Pages

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/settings/tokens/page.tsx`

- [ ] **Step 1: Update Admin page**

Read `src/app/admin/page.tsx`. Apply warm palette to:

- Page background: `var(--bg-sidebar)`
- Tab active state: `var(--text-primary)` text + bottom border `var(--accent)`
- Tab inactive: `var(--text-tertiary)`
- Card/panel backgrounds: `var(--bg-page)`, borders `var(--border-subtle)`
- Form inputs: `var(--bg-page)` bg, `var(--border-medium)` border, `4px` radius
- Buttons: primary `var(--accent)`, destructive `var(--danger)`
- History table: warm text colors, muted badges
- Remove all `dark:` variants

- [ ] **Step 2: Update Tokens page**

Read `src/app/settings/tokens/page.tsx`. Apply same warm palette:

- Page background: `var(--bg-sidebar)`
- Token list card: `var(--bg-page)` with `var(--border-subtle)`
- Buttons: primary `var(--accent)`, delete `var(--danger)`
- Form inputs: same warm input styling
- Remove all `dark:` variants

- [ ] **Step 3: Verify in browser**

Check admin and tokens pages in both modes:
- Tabs look Notion-like (active has accent underline)
- Forms have visible warm borders
- All text readable in both modes

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/app/settings/tokens/page.tsx
git commit -m "feat: update Admin and Settings pages with warm palette"
```

---

## Task 10: Favicon & Final Verification

**Files:**
- Create: `public/favicon.svg` (or update `public/favicon.ico`)

- [ ] **Step 1: Create favicon**

Create `public/favicon.svg` with the same logo mark used in the Header, sized for favicon use (simple, recognizable at 32x32):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <path d="M4 6C4 4.89543 4.89543 4 6 4H13L16 7H26C27.1046 7 28 7.89543 28 9V26C28 27.1046 27.1046 28 26 28H6C4.89543 28 4 27.1046 4 26V6Z" fill="#37352F" fill-opacity="0.85"/>
  <path d="M15 14L18.5 17.5M18.5 17.5L22 14M18.5 17.5V23" stroke="#337EA9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="18" r="3" stroke="#337EA9" stroke-width="2" fill="none"/>
</svg>
```

Update the favicon reference in `src/app/layout.tsx` if it points to `.ico` — change to `.svg` or generate an `.ico` from the SVG.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: Same pass/fail as before (no functional changes)

- [ ] **Step 3: Run lint on all modified files**

Run: `npx eslint src/components/layout/Header.tsx src/components/layout/Sidebar.tsx src/components/project/ProjectCard.tsx src/components/design/DesignCard.tsx src/components/design/RelatedDesigns.tsx src/components/comments/CommentSidebar.tsx`
Expected: Clean (warnings about `any` OK)

- [ ] **Step 4: Full visual walkthrough**

Test every page in BOTH light and dark mode:

1. `/login` — warm card, readable inputs, blue focus border
2. `/register` — same as login
3. `/dashboard` — warm background, card hover shadows, text hierarchy
4. `/project/[id]` — sidebar warm, folder items styled, content area clear
5. `/project/[id]/design/[id]` — toolbar warm, breadcrumbs muted, status badge muted
6. `/admin` — tabs styled, forms warm, history tables readable
7. `/settings/tokens` — warm page, card styling
8. Toggle dark mode on EVERY page — verify no invisible text, no missing borders, no contrast issues

- [ ] **Step 5: Commit**

```bash
git add public/favicon.svg src/app/layout.tsx
git commit -m "feat: add new favicon and complete UI refresh verification"
```
