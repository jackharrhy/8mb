---
name: 8mb
description: A restrained browser-local video editing workspace inherited from jack/auth.
colors:
  bg: "#fafaf9"
  panel: "#f5f5f4"
  ink: "#0c0a09"
  muted: "#57534e"
  line: "#e7e5e4"
  border: "#78716c"
  hover: "#e7e5e4"
  accent: "#2563eb"
  selected: "#dbeafe"
  error: "#b91c1c"
  on-primary: "#fafaf9"
  dark-bg: "#0c0a09"
  dark-panel: "#1c1917"
  dark-ink: "#f5f5f4"
  dark-muted: "#a8a29e"
  dark-line: "#292524"
  dark-border: "#78716c"
  dark-hover: "#292524"
  dark-accent: "#93b4f7"
  dark-selected: "#1e3a5f"
  dark-error: "#fca5a5"
  dark-on-primary: "#0c0a09"
typography:
  headline:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "12px"
  command:
    fontFamily: "ui-monospace, monospace"
    fontSize: "14px"
    lineHeight: 1.6
rounded:
  control: "6px"
  preview: "8px"
  timeline: "5px"
  handle: "3px"
spacing:
  space-4: "4px"
  space-6: "6px"
  space-8: "8px"
  space-10: "10px"
  space-12: "12px"
  space-16: "16px"
  space-20: "20px"
  space-24: "24px"
  space-28: "28px"
  space-32: "32px"
  space-36: "36px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-primary-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 10px"
  navigation-current:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  preview:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.preview}"
    height: "370px"
---

# Design System: 8mb

## Overview

**Creative North Star: "The quiet working surface"**

The inherited jack/auth world is a quiet working surface: warm stone neutrals, compact Inter typography, and clearly bounded controls. The video and its editing selections carry the visual attention.

The interface uses a restrained utility aesthetic with explicit text, aligned numeric fields, and system light/dark themes. The editor stays visually consistent with the command workspace.

**Key Characteristics:**
- Warm stone neutrals and restrained blue selections.
- Compact Inter typography with precise numeric controls.
- Flat surfaces, fine separators, and gently rounded controls.

## Colors

The palette inherits warm stone surfaces and ink from jack/auth. Frontmatter records the exact implemented values; `dark-` entries replace their corresponding light tokens under the system dark preference.

### Primary

Ink fills the primary action, with on-primary text. Muted ink supplies its hover state. This primary action remains neutral in both themes.

### Secondary

Accent blue marks trim selection, selected crop controls, and drag-over feedback; selected supplies the pale selection fill. Error red is reserved for failure messages.

### Neutral

Background is the page and input ground. Panel distinguishes the preview, logs, and current navigation. Ink carries content, muted carries hints and metadata, line separates regions, border defines controls, and hover fills secondary actions. A loaded video preview retains a dark stone ground in both themes.

**The Selection Rule.** Blue describes editing state; the principal action uses neutral ink.

## Typography

Inter is bundled locally as a variable font, with Arial and sans-serif fallbacks. The headline uses tight tracking and moderate weight; section titles stay at body scale. Body copy is compact with comfortable paragraph leading. Helper labels and metadata step down to the label scale; the empty preview heading uses an intermediate (18px/26px) treatment.

Numeric inputs, the time ruler, and export values use tabular numerals. Commands use the system monospace stack; output logs and inline code use a smaller (12px) size.

## Layout

Header and workspace share a centered outer maximum (1168px), including side gutters (24px), yielding an inner workspace (1120px). The header has a minimum height (65px). The main workspace starts below it (34px). Desktop editing uses a flexible preview column and export column (272px), separated by a gap (32px); the export column has a left rule and inset (28px).

At viewport widths of (800px) or less, the columns stack with export settings after the timeline, separated by a top rule. Settings use two columns until (480px), then one. At (480px) or less, gutters become (16px), main top spacing becomes (24px), trim and crop numeric fields use two columns, and actions may wrap. Standard buttons and form fields target a minimum height (44px) on this small-screen breakpoint; compact controls retain their specific styles where more-specific selectors apply.

Preview height steps from (370px) to (360px) and then (260px). The timeline remains a compact (66px) strip. Repeated spacing values in frontmatter describe the actual working rhythm rather than a new scale.

## Elevation & Depth

The workspace is flat: panel tones and thin borders separate surfaces, with no decorative elevation. The crop overlay uses a large spread shadow solely to dim the excluded image area; the timeline handle uses a thin shadow as a selection outline. These are editing affordances rather than raised cards.

Output appears with a short reveal (0.2s ease-out), moving upward from (4px) while opacity rises from (0.4). Reduced-motion preference disables animations. Pressed buttons move down (1px).

## Shapes

Controls and navigation use gently curved control corners. The preview is slightly softer, while the timeline and trim handles use tighter corners. Borders are thin (1px); the crop frame is white and stronger (2px), with a fine internal guide. Avoid introducing card containers around every group: rules and space carry grouping.

## Components

### Buttons

Primary actions use solid ink, contrasting on-primary text, and an ink border. Secondary actions use the page background with a stronger neutral border; hover uses the hover surface. Shared padding and corner tokens keep both variants consistent. Disabled buttons use muted text and reduced opacity (0.55). Compact preview and preset buttons use smaller type and dimensions.

### Inputs

Numeric fields and selects share a full-width bordered control. Numeric units sit inside a common bordered group, with the unit muted and aligned right. Textareas use monospace and larger internal padding (12px). Labels sit above controls with a gap (8px).

### Navigation

Edit and Advanced sit beside the brand as compact links. Current and hovered links use the panel surface and ink; inactive links use muted ink. Mobile reduces their side padding.

### Preview and timeline

The empty preview centers a small outline film icon, a short heading, explanatory text, a primary file action, and a privacy hint. Loaded media fits within the dark preview. The waveform region uses a panel background, translucent blue selection, blue boundaries, and narrow draggable handles; exact numeric fields sit below it. Crop mode dims the excluded region and shows numeric alternatives.

### Export and command output

Export settings use labels, compact neutral size presets, a disclosure, aligned definition-list values, and a full-width primary action. Advanced commands use a monospace field and a bounded, scrollable panel for logs. Results use a separator and an inline reveal rather than a modal.

**The Focus Rule.** Interactive elements show a muted outline (2px) offset from their edge (3px); unit fields show the same ring around the whole group.

## Do's and Don'ts

### Do:

- Do inherit the jack/auth warm stone palette and Inter typography.
- Do reserve blue for editing selection, crop mode, and file drop feedback.
- Do keep numeric editing alternatives beside direct manipulation.
- Do preserve visible keyboard focus and system dark/reduced-motion preferences.

### Don't:

- Don't add decorative shadows or ornamental imagery to the workspace.
- Don't turn neutral primary actions into blue promotional buttons.
- Don't use monospace for general interface copy; reserve it for commands and output.
