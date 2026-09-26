# Change Log: Default AI-Formbuilder Visual Identity

Date: 2026-09-26 05:22:45 (+02:00)

The construction page and its original stylesheet were inspected first and remain the original visual reference. The values below are the default AI-Formbuilder visual identity for construction, login, platform administration, and future application pages.

## Color Palette

- Primary accent: `#3b82f6`.
- Dark/navy and page background: `#0b1224`.
- Surface/card overlay: `rgba(148, 163, 184, 0.12)`, the existing construction progress-track color, layered over the navy background.
- Primary text: `#ffffff`.
- Brand/secondary text: `#cbd5e1`.
- Muted text: `#94a3b8`; subdued text: `#64748b`; footer text: `#475569`.
- Status blue: `#60a5fa`.
- Border: `rgba(148, 163, 184, 0.15)`.
- Construction grid: `rgba(59, 130, 246, 0.035)`.
- Existing blue glow values: `rgba(37, 99, 235, 0.5)` and `rgba(37, 99, 235, 0.18)`.
- The construction stylesheet did not define semantic success/error colors or control hover/focus states. Shared controls use the existing blue/slate palette; focus uses the primary blue, and hover brightens the existing blue control without adding a new hue. Alert/success messages are identified by their text and accessible semantics, not a new color family.

These values are centralized in `public/css/visual-identity.css`. The construction page now references variables with the same computed values; its layout, image, background pattern, and animation are unchanged.

## Typography and Branding

- Font family: `Arial, Helvetica, sans-serif`, taken from the construction page.
- Body copy: regular Arial with secondary text in the existing slate palette.
- Construction display heading: bold, 38–64px, 1.05 line-height, with its existing tight treatment.
- Shared wordmark: `AI-Formbuilder`, 18px, bold; `AI` uses primary blue and `-Formbuilder` uses `#cbd5e1`. The wordmark retains the original `-0.5px` letter spacing and capitalization.

## Component Style

- Buttons: blue fill, white text, compact 4–5px radius; hover brightens the same blue.
- Inputs: navy fill, translucent slate border, white text, visible 3px blue focus outline.
- Panels/cards: dark translucent surface, translucent slate border, restrained blue glow; 6–7px radius.
- Navigation: navy sidebar, slate labels, translucent slate active/hover surface, blue active marker.
- Layout: clean corporate hierarchy, moderate spacing, responsive sidebar/navigation and single-column small-screen layouts.

## Pages Updated

- Construction page (reference only; computed colors remain unchanged).
- `/login` and the shared access-denied page.
- `/admin`, `/admin/profile`, `/admin/settings`, `/admin/organizations`, `/admin/users`, `/admin/onboarding`, and `/admin/security`.

## Future Use

The construction page is the original visual reference. This documented style is now the default AI-Formbuilder visual identity. Before creating or restyling a page, consult this note and reuse `public/css/visual-identity.css`; do not introduce another palette unless the product explicitly approves a deliberate exception.
