# VS Code Theming Integration

This document explains how VS Code theming is integrated into the webview UI.

## Overview

The webview UI now supports native VS Code theming, which means it will automatically adapt to the user's selected VS Code theme, including:

- Light themes
- Dark themes
- High contrast themes

## How It Works

### CSS Variables

VS Code provides theme colors through CSS variables prefixed with `vscode-` (replacing `.` with `-`). For example, the editor background color is available as `--vscode-editor-background`.

These variables are mapped to our custom CSS variables in `index.css`:

```css
:root {
  --background: var(--vscode-editor-background);
  --foreground: var(--vscode-editor-foreground);
  /* ... more mappings ... */
}
```

### Theme Classes

VS Code adds classes to the body element to indicate the current theme:
- `vscode-light` - Light themes
- `vscode-dark` - Dark themes
- `vscode-high-contrast` - High contrast themes

We use these classes to apply theme-specific styles.

### Tailwind Integration

The Tailwind configuration has been updated to include VS Code theme colors:

```js
colors: {
  'vscode': {
    'bg': 'var(--vscode-editor-background)',
    'fg': 'var(--vscode-editor-foreground)',
    /* ... more colors ... */
  },
},
```

This allows you to use these colors in your Tailwind classes, e.g., `bg-vscode-bg` or `text-vscode-fg`.

## Utility Functions

The `utils/theme.ts` file provides utility functions for working with VS Code themes:

- `getVSCodeThemeType()` - Returns the current theme type ('light', 'dark', or 'high-contrast')
- `isDarkTheme()` - Returns true if the current theme is dark or high contrast
- `isHighContrastTheme()` - Returns true if the current theme is high contrast
- `getThemeVar(name, fallback)` - Gets a CSS variable value from the current VS Code theme
- `onThemeChange(callback)` - Registers a callback to be called when the VS Code theme changes

## CSS Classes

The `styles/vscode-theme.css` file provides ready-to-use CSS classes for common UI elements:

- Text colors: `.vscode-text`, `.vscode-text-light`, etc.
- Background colors: `.vscode-bg`, `.vscode-bg-sidebar`, etc.
- Border colors: `.vscode-border`, `.vscode-border-input`, etc.
- Button styles: `.vscode-button`, `.vscode-button-secondary`
- Input styles: `.vscode-input`
- Link styles: `.vscode-link`
- Badge styles: `.vscode-badge`
- Card styles: `.vscode-card`

## Usage Examples

### Using CSS Variables

```css
.my-component {
  background-color: var(--background);
  color: var(--foreground);
}
```

### Using Tailwind Classes

```jsx
<div className="bg-vscode-bg text-vscode-fg p-4">
  <h1 className="text-vscode-button-bg">Hello World</h1>
</div>
```

### Using Utility Functions

```jsx
import { isDarkTheme } from '@/utils/theme';

function MyComponent() {
  return (
    <div>
      {isDarkTheme() ? 'Dark theme is active' : 'Light theme is active'}
    </div>
  );
}
```

### Using CSS Classes

```jsx
<button className="vscode-button">Click Me</button>
<input className="vscode-input" placeholder="Enter text..." />
<div className="vscode-card">This is a card</div>
```

## Theme Color Reference

For a complete list of available VS Code theme colors, refer to the [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color).
