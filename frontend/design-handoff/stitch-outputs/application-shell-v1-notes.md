---
name: Nexus Security Governance
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fd'
  surface-container: '#ededf8'
  surface-container-high: '#e7e7f2'
  surface-container-highest: '#e1e2ec'
  on-surface: '#191b23'
  on-surface-variant: '#434654'
  inverse-surface: '#2e3038'
  inverse-on-surface: '#f0f0fb'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#4f5f7b'
  on-secondary: '#ffffff'
  secondary-container: '#cdddff'
  on-secondary-container: '#51617e'
  tertiary: '#7b2600'
  on-tertiary: '#ffffff'
  tertiary-container: '#a33500'
  on-tertiary-container: '#ffc6b2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#b7c7e8'
  on-secondary-fixed: '#091c35'
  on-secondary-fixed-variant: '#374763'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ec'
  status-success: '#36B37E'
  status-warning: '#FFAB00'
  status-error: '#FF5630'
  status-info: '#00B8D9'
  surface-subtle: '#F4F5F7'
  border-neutral: '#DFE1E6'
  text-caption: '#6B778C'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 240px
  topbar-height: 56px
  gutter: 16px
  container-padding: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---
# Application Shell V1 Notes

本图作为 SAPD Wiki Application Shell V1 高保真设计输入。

本轮设计目标是确定全局导航、顶部栏、页面标题区、三栏工作台承载结构和高保真信息密度。

注意：
- 图中的“本地关联摘要”仅作为安全能力映射工作台的承载示例。
- 不要求在 Application Shell 实现阶段完整实现关系图谱能力。
- LocalRelationSummary / LocalRelationMap 组件应在后续“安全能力映射工作台”专项设计中进一步细化。
- Codex 实现 Application Shell 时不得直接按该关系区完整实现业务逻辑。
## Brand & Style

The design system is engineered for the **SAPD Wiki**, a specialized security knowledge and capability mapping portal. The brand personality is **expert, authoritative, and stable**, reflecting the mission-critical nature of security architecture and governance. It prioritizes **utilitarian efficiency** over aesthetic decoration, targeting security professionals who manage complex data relationships and compliance frameworks.

The visual style is **Corporate / Modern**, characterized by:
- **High Information Density:** Maximum screen real estate is dedicated to structured data, avoiding oversized margins or decorative "hero" sections.
- **Systematic Clarity:** A restrained visual language that uses subtle tonal shifts and borders rather than shadows or depth to organize complex workbenches.
- **Knowledge-Centric:** Layouts are optimized for "reading and doing," with a clear distinction between technical and management perspectives.
- **Stability:** A rigid, grid-based structure that provides a sense of order and institutional reliability.

## Colors

The palette is anchored in **Professional Blues and Grays** to evoke trust and reduce visual fatigue during long periods of technical analysis.

- **Primary Blue:** Used for actionable elements, active states, and primary branding. It provides high contrast against the neutral background.
- **Secondary Slate:** Used for navigation and structural labels, maintaining a professional distance from content.
- **Neutral Foundation:** The system uses a predominantly white background (`#FFFFFF`) with subtle gray layering (`#F4F5F7`) to distinguish content containers and sidebars.
- **Semantic Colors:** Green (Success), Amber (Warning), and Red (Critical) are reserved strictly for status indicators, priority levels (P0-P3), and compliance health.

## Typography

**Inter** is the sole sans-serif typeface, selected for its exceptional legibility in data-heavy environments and its neutral, systematic character.

- **Hierarchy:** We use a tight scale to maintain information density. Headline-xl is reserved for page titles, while most interface labels operate at the 12px-14px range.
- **Numerical Data:** For technical IDs and mapping codes (e.g., OBJ-APP-001), use a monospaced font (JetBrains Mono) to ensure character alignment and distinction from prose.
- **Contrast:** High-weight semibold (600) is used sparingly for headers and active navigation items to guide the eye without overwhelming the layout.

## Layout & Spacing

The layout uses a **Fixed Grid** approach for the core application shell to ensure predictable tool placement.

- **Application Shell:** Features a permanent left sidebar (240px) for primary navigation and a compact top bar (56px) for global search and utilities. 
- **The Workbench Model:** Most pages follow a 3-column structural pattern:
    1.  **Left:** Foldable directory/tree navigation (searchable).
    2.  **Center:** Main canvas for relationship mapping or document content.
    3.  **Right:** Contextual "Detail Drawers" or "Source Evidence" panels that overlap or push the center content.
- **Density:** We employ an 8px base grid, but tighten component internals to 4px to maximize data visibility in tables and lists.

## Elevation & Depth

To maintain a "flat," professional aesthetic, depth is conveyed through **Tonal Layers** rather than shadows.

- **Level 0 (Background):** Neutral light gray (#F4F5F7).
- **Level 1 (Cards/Content):** Pure white (#FFFFFF) with a 1px neutral border (#DFE1E6). This is the primary surface for all data tables and workbench canvases.
- **Level 2 (Overlays/Drawers):** Pure white with a subtle, low-opacity ambient shadow (Blur 8px, Opacity 4%) to indicate temporary focus, such as detail drawers or dropdowns.
- **Interaction:** Hover states utilize a subtle background tint change (e.g., White to #F8F9FA) rather than an elevation lift.

## Shapes

The shape language is **Soft (0.25rem)**, providing a modern but disciplined appearance. 

- **Components:** Buttons, input fields, and cards use the standard 4px radius.
- **Tags/Chips:** Use the same 4px radius or "rounded-lg" (8px) for semantic status labels to distinguish them from interactive buttons.
- **Pill Shapes:** Strictly reserved for "Status" indicators (e.g., "Published," "Under Construction") to ensure they are visually distinct from the structural grid.

## Components

- **Navigation Sidebar:** High-contrast background with active states indicated by a primary blue left-accent border and a light blue background tint.
- **Global Search:** Centrally located in the top bar, featuring a keyboard shortcut hint (⌘K) and a clear focus ring.
- **Workbenches:** Centralized layouts with searchable trees. Relationship lines in mapping views should be 1px solid gray with directional arrows.
- **Source Evidence Panels:** Default to a "collapsed" state or accordion. Use a distinct "metadata" style (smaller text, italics) for source citations to separate them from core technical data.
- **Data Tables:** Zebra striping is avoided in favor of 1px horizontal dividers. Header rows use a subtle gray background with all-caps label-sm typography.
- **Status Tags:** Use light background tints with dark text (e.g., Light Green background with Dark Green text) to ensure readability without being visually aggressive.
- **Action Buttons:** Primary actions are solid blue; secondary actions are outlined or ghost-style to maintain hierarchy.
