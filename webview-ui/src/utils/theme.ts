/**
 * Utility functions for working with VS Code themes
 */

/**
 * Get the current VS Code theme type
 * @returns 'light', 'dark', or 'high-contrast'
 */
export function getVSCodeThemeType(): 'light' | 'dark' | 'high-contrast' {
  if (document.body.classList.contains('vscode-high-contrast')) {
    return 'high-contrast';
  } else if (document.body.classList.contains('vscode-dark')) {
    return 'dark';
  } else {
    return 'light';
  }
}

/**
 * Check if the current VS Code theme is a dark theme
 * @returns true if the current theme is dark or high contrast
 */
export function isDarkTheme(): boolean {
  return getVSCodeThemeType() !== 'light';
}

/**
 * Check if the current VS Code theme is a high contrast theme
 * @returns true if the current theme is high contrast
 */
export function isHighContrastTheme(): boolean {
  return getVSCodeThemeType() === 'high-contrast';
}

/**
 * Get a CSS variable value from the current VS Code theme
 * @param name The name of the CSS variable (without the --vscode- prefix)
 * @param fallback Optional fallback value if the variable is not defined
 * @returns The value of the CSS variable
 */
export function getThemeVar(name: string, fallback?: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--vscode-${name}`)
    .trim() || fallback || '';
}

/**
 * Register a callback to be called when the VS Code theme changes
 * @param callback The callback to call when the theme changes
 * @returns A function to remove the listener
 */
export function onThemeChange(callback: () => void): () => void {
  // VS Code doesn't have a direct event for theme changes,
  // but we can observe changes to the body class list
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === 'class'
      ) {
        callback();
        break;
      }
    }
  });

  observer.observe(document.body, { attributes: true });

  // Return a function to remove the observer
  return () => observer.disconnect();
}

export default {
  getVSCodeThemeType,
  isDarkTheme,
  isHighContrastTheme,
  getThemeVar,
  onThemeChange,
};
