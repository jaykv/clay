/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // VS Code theme colors
        'vscode': {
          // Background colors
          'bg': 'var(--vscode-editor-background)',
          'sidebar-bg': 'var(--vscode-sideBar-background)',
          'header-bg': 'var(--vscode-editorGroupHeader-tabsBackground)',
          'input-bg': 'var(--vscode-input-background)',
          'selection-bg': 'var(--vscode-editor-selectionBackground)',
          'inactive-selection-bg': 'var(--vscode-editor-inactiveSelectionBackground)',
          'list-hover-bg': 'var(--vscode-list-hoverBackground)',
          'list-active-bg': 'var(--vscode-list-activeSelectionBackground)',

          // Text colors
          'fg': 'var(--vscode-editor-foreground)',
          'sidebar-fg': 'var(--vscode-sideBar-foreground)',
          'input-fg': 'var(--vscode-input-foreground)',
          'description-fg': 'var(--vscode-descriptionForeground)',
          'button-fg': 'var(--vscode-button-foreground)',
          'list-active-fg': 'var(--vscode-list-activeSelectionForeground)',
          'error-fg': 'var(--vscode-errorForeground)',
          'warning-fg': 'var(--vscode-editorWarning-foreground)',
          'info-fg': 'var(--vscode-editorInfo-foreground)',
          'link-fg': 'var(--vscode-textLink-foreground)',
          'link-active-fg': 'var(--vscode-textLink-activeForeground)',

          // Border colors
          'panel-border': 'var(--vscode-panel-border)',
          'input-border': 'var(--vscode-input-border)',
          'focus-border': 'var(--vscode-focusBorder)',

          // Button colors
          'button-bg': 'var(--vscode-button-background)',
          'button-hover-bg': 'var(--vscode-button-hoverBackground)',
          'button-fg': 'var(--vscode-button-foreground)',
          'button-secondary-bg': 'var(--vscode-button-secondaryBackground)',
          'button-secondary-fg': 'var(--vscode-button-secondaryForeground)',
          'button-secondary-hover-bg': 'var(--vscode-button-secondaryHoverBackground)',
          'success-bg': 'var(--vscode-button-background)',
          'success-fg': 'var(--vscode-button-foreground)',
          'error-fg': 'var(--vscode-errorForeground)',
          'warning-fg': 'var(--vscode-editorWarning-foreground)',
        },
      },

      fontFamily: {
        sans: ['var(--vscode-editor-font-family)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--vscode-editor-font-family)', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
