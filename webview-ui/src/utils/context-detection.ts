/**
 * Context detection utilities for determining if the app is running
 * in VSCode webview or standalone web browser
 */

export type AppContext = 'vscode' | 'web';

/**
 * Detect the current application context
 */
export function detectContext(): AppContext {
  // Check if we're in a VSCode webview
  if (typeof window !== 'undefined') {
    // VSCode webview has the acquireVsCodeApi function
    if ('acquireVsCodeApi' in window) {
      return 'vscode';
    }

    // Check for VSCode-specific CSS variables
    try {
      const testElement = document.createElement('div');
      document.body.appendChild(testElement);
      const computedStyle = getComputedStyle(testElement);
      const hasVSCodeVars = computedStyle.getPropertyValue('--vscode-editor-background');
      document.body.removeChild(testElement);

      if (hasVSCodeVars) {
        return 'vscode';
      }
    } catch (error) {
      // Ignore errors in CSS variable detection
    }

    // Check user agent for VSCode
    if (navigator.userAgent.includes('VSCode')) {
      return 'vscode';
    }
  }

  return 'web';
}

/**
 * Initialize context-specific styling and behavior
 */
export function initializeContext(): AppContext {
  const context = detectContext();

  if (typeof document !== 'undefined') {
    // Add context class to body
    document.body.classList.add(`${context}-context`);

    // Set data attribute for CSS targeting
    document.documentElement.setAttribute('data-context', context);

    if (context === 'web') {
      // Initialize web-specific features
      initializeWebContext();
    } else {
      // Initialize VSCode-specific features
      initializeVSCodeContext();
    }
  }

  return context;
}

/**
 * Initialize web browser specific features
 */
function initializeWebContext(): void {
  // Add theme toggle button
  addThemeToggle();

  // Initialize theme from localStorage or system preference
  initializeTheme();

  // Add web-specific event listeners
  addWebEventListeners();
}

/**
 * Initialize VSCode webview specific features
 */
function initializeVSCodeContext(): void {
  // VSCode-specific initialization
  console.log('Running in VSCode webview context');

  // You can add VSCode-specific features here
  // For example, communication with the extension host
}

/**
 * Add theme toggle button for web context
 */
function addThemeToggle(): void {
  const toggleButton = document.createElement('button');
  toggleButton.className = 'theme-toggle';
  toggleButton.textContent = '🌓 Theme';
  toggleButton.title = 'Toggle light/dark theme';

  toggleButton.addEventListener('click', toggleTheme);
  document.body.appendChild(toggleButton);
}

/**
 * Initialize theme based on stored preference or system setting
 */
function initializeTheme(): void {
  const storedTheme = localStorage.getItem('clay-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let theme: 'light' | 'dark';

  if (storedTheme === 'light' || storedTheme === 'dark') {
    theme = storedTheme;
  } else {
    theme = systemPrefersDark ? 'dark' : 'light';
  }

  applyTheme(theme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('clay-theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme(): void {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  applyTheme(newTheme);
  localStorage.setItem('clay-theme', newTheme);
}

/**
 * Apply a specific theme
 */
function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);

  // Update theme toggle button text
  const toggleButton = document.querySelector('.theme-toggle') as HTMLButtonElement;
  if (toggleButton) {
    toggleButton.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
  }
}

/**
 * Add web-specific event listeners
 */
function addWebEventListeners(): void {
  // Handle keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Shift + T to toggle theme
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      toggleTheme();
    }
  });

  // Handle window focus/blur for better UX
  window.addEventListener('focus', () => {
    document.body.classList.add('window-focused');
  });

  window.addEventListener('blur', () => {
    document.body.classList.remove('window-focused');
  });
}

/**
 * Get the current context
 */
export function getCurrentContext(): AppContext {
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('data-context') as AppContext || 'web';
  }
  return 'web';
}

/**
 * Check if running in VSCode
 */
export function isVSCodeContext(): boolean {
  return getCurrentContext() === 'vscode';
}

/**
 * Check if running in web browser
 */
export function isWebContext(): boolean {
  return getCurrentContext() === 'web';
}
