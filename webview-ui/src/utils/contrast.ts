/**
 * Utility functions for working with text contrast in VS Code themes
 */

import { getThemeVar, isDarkTheme } from './theme';

/**
 * Get the appropriate text color for a given background color
 * @param _bgColorVar The VS Code theme variable for the background color
 * @param lightTextVar The VS Code theme variable for light text
 * @param darkTextVar The VS Code theme variable for dark text
 * @returns The appropriate text color variable
 */
export function getContrastText(
  _bgColorVar: string = 'editor-background',
  lightTextVar: string = 'editor-foreground',
  darkTextVar: string = 'editor-foreground'
): string {
  // For simplicity, we'll use the theme type to determine text color
  // A more sophisticated approach would calculate contrast ratios
  return isDarkTheme() ? getThemeVar(lightTextVar) : getThemeVar(darkTextVar);
}

/**
 * Apply appropriate text color based on the current theme
 * @param element The DOM element to update
 * @param bgColorVar The VS Code theme variable for the background color
 */
export function applyContrastText(
  element: HTMLElement,
  bgColorVar: string = 'editor-background'
): void {
  const textColor = getContrastText(
    bgColorVar,
    'editor-foreground',
    'editor-foreground'
  );
  element.style.color = textColor;
}

export default {
  getContrastText,
  applyContrastText,
};
