// This utility helps us communicate with the VS Code extension
// It provides a type-safe way to send messages to the extension

// Define the VS Code API that's available in the webview
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: <T>(message: T) => void;
      getState: <T>() => T | undefined;
      setState: <T>(state: T) => void;
    };
  }
}

// Initialize the VS Code API
let vscode: ReturnType<typeof window.acquireVsCodeApi>;

// Commands that can be sent to the extension
export type VSCodeCommand =
  | { command: 'startGatewayServer' }
  | { command: 'stopGatewayServer' }
  | { command: 'startMCPServer' }
  | { command: 'stopMCPServer' }
  | { command: 'refresh' }
  | { command: 'openRoutesManager' }
  | { command: 'navigate'; route: string }
  | { command: 'getServerStatus' }
  | { command: 'switchTab'; tab: string }
  | { command: 'clay.searchCodebase' }
  | { command: 'clay.getSymbolDefinition' }
  | { command: 'clay.findReferences' }
  | { command: 'clay.reindexCodebase' }
  | { command: 'clay.chatMessage'; message: string }
  | { command: 'clay.openSettings' }
  | { command: string }; // Allow for dynamic command strings

/**
 * Initialize the VS Code API
 * This should be called once when the app starts
 * Returns true if running in VS Code, false if running in browser
 */
export function initVSCodeAPI(): boolean {
  if (typeof window.acquireVsCodeApi === 'function' && !vscode) {
    try {
      vscode = window.acquireVsCodeApi();
      return true;
    } catch (e) {
      console.warn('Failed to acquire VS Code API:', e);
    }
  }
  return false;
}

/**
 * Send a message to the VS Code extension
 * @param message The message to send
 * @returns true if the message was sent, false if not in VS Code environment
 */
export function postMessage(message: VSCodeCommand): boolean {
  if (vscode) {
    vscode.postMessage(message);
    return true;
  } else {
    // When running in browser directly, log the message
    console.log('Running in browser mode, VS Code message would be:', message);

    // Special handling for certain commands when running in browser
    if (message.command === 'startGatewayServer' || message.command === 'stopGatewayServer') {
      console.log('Note: Server controls are not available when running in browser mode');
    }

    return false;
  }
}

/**
 * Get the current state from VS Code
 */
export function getState<T>(): T | undefined {
  if (vscode) {
    return vscode.getState();
  }
  return undefined;
}

/**
 * Set the state in VS Code
 * @param state The state to set
 */
export function setState<T>(state: T): void {
  if (vscode) {
    vscode.setState(state);
  }
}

// Export a default object for easier imports
const vscodeUtils = {
  initVSCodeAPI,
  postMessage,
  getState,
  setState,
};

export default vscodeUtils;
