# Clay Dashboard UI (Vite Version)

This is the webview UI for the Clay VS Code extension. It's built with Vite, React, and Tailwind CSS.

## Development

To start the development server:

```bash
npm run dev
```

This will start the Vite development server at http://localhost:5173.

## Building

To build the UI for production:

```bash
npm run build
```

This will generate static HTML, CSS, and JavaScript files in the `dist` directory, which will be used by the VS Code extension.

## Structure

- `src/components`: React components
- `src/pages`: Page components
- `src/lib`: Utility functions and API clients
- `src/utils`: Utility functions, including VS Code webview integration

## VS Code Integration

The `src/utils/vscode.ts` file contains utilities for communicating with the VS Code extension. It provides a type-safe way to send messages to the extension.

