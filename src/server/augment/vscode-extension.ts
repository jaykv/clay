import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { AugmentContextEngine } from './index';
import { VSCodeAPI } from './vscode-api';

/**
 * Initialize the Augment Context Engine with VS Code extension context
 * This should be called from the extension's activate function
 */
export function initializeAugmentContextEngineForVSCode(context: vscode.ExtensionContext): void {
  logger.info('Initializing Augment Context Engine for VS Code extension');

  try {
    // Get the Augment Context Engine instance
    const augmentEngine = AugmentContextEngine.getInstance();

    // Get the VS Code API instance
    const vscodeAPI = VSCodeAPI.getInstance();

    // Initialize the VS Code API with the extension context
    vscodeAPI.initialize(context);

    // Explicitly set the VS Code API on the Augment Context Engine
    // This ensures the engine will use the VS Code API
    augmentEngine.setVSCodeAPI(vscodeAPI);

    // Initialize the Augment Context Engine
    // This will use the VS Code API we just set
    augmentEngine.initialize();

    // Register commands for the Augment Context Engine
    registerAugmentCommands(context, augmentEngine);

    logger.info('Augment Context Engine initialized successfully for VS Code extension');
  } catch (error) {
    logger.error('Failed to initialize Augment Context Engine for VS Code extension:', error);
  }
}

/**
 * Register VS Code commands for the Augment Context Engine
 */
function registerAugmentCommands(
  context: vscode.ExtensionContext,
  augmentEngine: AugmentContextEngine
): void {
  // Register command to search the codebase
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.searchCodebase', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Enter search query',
        placeHolder: 'Search the codebase...',
      });

      if (!query) {
        return;
      }

      try {
        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Searching codebase for "${query}"`,
            cancellable: false,
          },
          async progress => {
            // Search the codebase
            const results = await augmentEngine.searchCode(query);

            if (results.length === 0) {
              vscode.window.showInformationMessage(`No results found for "${query}"`);
              return;
            }

            // Show results in a quick pick
            const items = results.flatMap(result =>
              result.snippets.map(snippet => ({
                label: `$(file) ${snippet.filePath}`,
                description: `Line ${snippet.startLine}-${snippet.endLine}`,
                detail:
                  snippet.content.length > 100
                    ? snippet.content.substring(0, 100) + '...'
                    : snippet.content,
                snippet,
              }))
            );

            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: `Found ${items.length} results for "${query}"`,
              matchOnDescription: true,
              matchOnDetail: true,
            });

            if (selected) {
              // Open the file and navigate to the snippet
              const document = await vscode.workspace.openTextDocument(selected.snippet.filePath);
              const editor = await vscode.window.showTextDocument(document);

              // Select the range
              const startPosition = new vscode.Position(selected.snippet.startLine - 1, 0);
              const endPosition = new vscode.Position(
                selected.snippet.endLine - 1,
                document.lineAt(selected.snippet.endLine - 1).text.length
              );

              editor.selection = new vscode.Selection(startPosition, endPosition);
              editor.revealRange(
                new vscode.Range(startPosition, endPosition),
                vscode.TextEditorRevealType.InCenter
              );
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error searching codebase: ${error}`);
      }
    })
  );

  // Register command to get symbol definition
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.getSymbolDefinition', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No active editor');
        return;
      }

      const position = editor.selection.active;
      const document = editor.document;

      try {
        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Finding symbol definition',
            cancellable: false,
          },
          async progress => {
            // Get the VS Code API
            const vscodeAPI = augmentEngine.getVSCodeAPI();
            if (!vscodeAPI) {
              vscode.window.showErrorMessage('VS Code API not available');
              return;
            }

            // Get the definition
            const definition = await vscodeAPI.getDefinition(
              document.fileName,
              position.line + 1, // Convert to 1-based
              position.character
            );

            if (!definition) {
              vscode.window.showInformationMessage('No definition found');
              return;
            }

            // Open the file and navigate to the definition
            const defDocument = await vscode.workspace.openTextDocument(definition.filePath);
            const defEditor = await vscode.window.showTextDocument(defDocument);

            // Select the range
            const startPosition = new vscode.Position(definition.startLine - 1, 0);
            const endPosition = new vscode.Position(
              definition.endLine - 1,
              defDocument.lineAt(definition.endLine - 1).text.length
            );

            defEditor.selection = new vscode.Selection(startPosition, endPosition);
            defEditor.revealRange(
              new vscode.Range(startPosition, endPosition),
              vscode.TextEditorRevealType.InCenter
            );
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error getting symbol definition: ${error}`);
      }
    })
  );

  // Register command to find references
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.findReferences', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No active editor');
        return;
      }

      const position = editor.selection.active;
      const document = editor.document;

      try {
        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Finding references',
            cancellable: false,
          },
          async progress => {
            // Get the VS Code API
            const vscodeAPI = augmentEngine.getVSCodeAPI();
            if (!vscodeAPI) {
              vscode.window.showErrorMessage('VS Code API not available');
              return;
            }

            // Get the references
            const references = await vscodeAPI.getReferences(
              document.fileName,
              position.line + 1, // Convert to 1-based
              position.character
            );

            if (!references || references.length === 0) {
              vscode.window.showInformationMessage('No references found');
              return;
            }

            // Show references in a quick pick
            const items = references.map(ref => ({
              label: `$(file) ${ref.filePath}`,
              description: `Line ${ref.startLine}`,
              detail: ref.name,
              reference: ref,
            }));

            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: `Found ${items.length} references`,
              matchOnDescription: true,
              matchOnDetail: true,
            });

            if (selected) {
              // Open the file and navigate to the reference
              const refDocument = await vscode.workspace.openTextDocument(
                selected.reference.filePath
              );
              const refEditor = await vscode.window.showTextDocument(refDocument);

              // Select the range
              const startPosition = new vscode.Position(selected.reference.startLine - 1, 0);
              const endPosition = new vscode.Position(
                selected.reference.endLine - 1,
                refDocument.lineAt(selected.reference.endLine - 1).text.length
              );

              refEditor.selection = new vscode.Selection(startPosition, endPosition);
              refEditor.revealRange(
                new vscode.Range(startPosition, endPosition),
                vscode.TextEditorRevealType.InCenter
              );
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error finding references: ${error}`);
      }
    })
  );

  // Register command to reindex the codebase
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.reindexCodebase', async () => {
      try {
        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Reindexing codebase',
            cancellable: false,
          },
          async progress => {
            // Reindex the codebase
            await augmentEngine.reindex();
            vscode.window.showInformationMessage('Codebase reindexed successfully');
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error reindexing codebase: ${error}`);
      }
    })
  );
}
