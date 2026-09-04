---
name: Vibe English Core
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#10b981'
  primary: '#10b981'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#1b6b51'
  on-tertiary: '#ffffff'
  tertiary-container: '#67b193'
  on-tertiary-container: '#00422f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#a6f2d1'
  tertiary-fixed-dim: '#8bd6b6'
  on-tertiary-fixed: '#002116'
  on-tertiary-fixed-variant: '#00513b'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  mint-surface: '#ECFDF5'
  success-deep: '#065F46'
  background-main: '#FFFFFF'
  border-subtle: '#E2E8F0'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The design system is built for a modern, mobile-first educational experience that balances academic rigor with an approachable, friendly personality. The brand identity is defined by a "Clean Corporate-Friendly" aesthetic—leveraging the precision of SaaS design with the warmth of educational software. 

The visual narrative focuses on high legibility, generous whitespace, and a mint-based palette that reduces cognitive load during study sessions. The style avoids heavy ornamentation, instead using subtle tonal layers and soft geometry to guide the learner's focus toward content and interactive exercises.

## Colors

The palette is anchored by a vibrant **Mint Green** (Primary), used for key actions and progress indicators to evoke a sense of growth and achievement. The **Dark Navy** (Secondary) provides high-contrast grounding for primary text and structural elements, ensuring accessibility and a professional "textbook" feel.

- **Primary:** Action-oriented mint green. Use for primary buttons, active states, and progress bars.
- **Secondary:** Deep navy. Use for headlines and high-hierarchy text.
- **Surface:** A pale mint wash (#ECFDF5) used for card backgrounds, success states, and secondary containers to distinguish interactive zones from the main white background.
- **Neutral:** Slate grays used for secondary labels and borders to maintain a clean, uncluttered interface.

## Typography

This design system utilizes **Geist** for its technical precision and exceptional legibility at small sizes, which is critical for language learning. 

- **Headlines:** Use Bold (700) or SemiBold (600) weights with slightly tightened letter-spacing for a modern, compact look.
- **Body Text:** Use Regular (400) weight for long-form reading. The line height is set to 1.5x for body text to ensure maximum readability during study sessions.
- **Labels:** Use Medium (500) weight for buttons and navigation items. All labels should use the Dark Navy color to ensure contrast.

## Layout & Spacing

The design system employs a **fluid-to-fixed grid** model. On mobile devices, use a single-column layout with 20px side margins and 16px gutters for card-based content. As the screen scales to tablet and desktop, transition to a max-width container (1200px) with an 8 or 12-column grid.

Spacing follows a strict 4px baseline. Vertical stacking should prioritize 16px and 24px gaps to maintain a sense of openness. Use the `mint-surface` background for full-width sections to break up long scrolling views.

## Elevation & Depth

Visual hierarchy is achieved through **tonal layering** and **low-contrast outlines** rather than heavy shadows.

- **Level 0 (Background):** Pure white.
- **Level 1 (Cards/Containers):** `mint-surface` background with a 1px border (#E2E8F0). 
- **Active State:** Use a 2px Primary Mint border to indicate focus or selection.
- **Shadows:** Use a single "Soft-Focus" shadow for floating elements (like Bottom Sheets or Modals): `0px 4px 20px rgba(15, 23, 42, 0.08)`. This keeps the UI feeling light and airy.

## Shapes

The shape language is "Soft-Modern," using significant corner rounding to appear friendly and non-intimidating. 

Standard components (Cards, Inputs) use a **0.5rem (8px)** radius. Larger structural components like hero containers or primary "flashcard" surfaces should use **1rem (16px)** to emphasize their importance. Interactive chips and primary buttons use a fully rounded/pill-shaped profile to differentiate them from static content.

## Components

- **Buttons:** Primary buttons are pill-shaped, using the Primary Mint background with White text. Secondary buttons use a `mint-surface` background with Primary Mint text.
- **Cards:** The central component of the experience. Cards should have a 1px `border-subtle`, 16px internal padding, and 16px corner radius.
- **Chips/Badges:** Small, pill-shaped indicators for difficulty levels or categories. Use Secondary Navy for category tags and Primary Mint for "Completed" states.
- **Inputs:** Use an 8px radius with a light gray border. On focus, the border should transition to a 2px Primary Mint stroke with a subtle mint glow.
- **Progress Bars:** Use a thick 8px track height with a Primary Mint fill and a `mint-surface` background for the empty track.
- **Lists:** Use "inset" style lists where each item is separated by a subtle 1px divider, with generous 16px vertical padding for touch-friendly interaction on mobile.