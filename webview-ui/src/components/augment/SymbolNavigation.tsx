import React from 'react';
import Button from '@/components/ui/Button';
import { postMessage } from '@/utils/vscode';

interface SymbolNavigationProps {
  className?: string;
}

const SymbolNavigation: React.FC<SymbolNavigationProps> = ({ className = '' }) => {
  // Function to trigger VS Code commands
  const executeCommand = (command: string) => {
    if (typeof window.acquireVsCodeApi !== 'function') {
      alert(`This command (${command}) is only available in VS Code.`);
      return;
    }

    // In VS Code, send the command to the extension
    postMessage({ command });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col space-y-2">
        <Button
          onClick={() => executeCommand('clay.getSymbolDefinition')}
          variant="secondary"
          className="w-full justify-start"
          leftIcon={<span className="material-icons text-sm">code</span>}
        >
          Go to Definition
          <span className="ml-auto text-xs text-vscode-descriptionForeground">
            Ctrl+Shift+G / Cmd+Shift+G
          </span>
        </Button>
        <p className="text-xs text-vscode-descriptionForeground ml-8">
          Jump to the definition of a symbol under the cursor
        </p>
      </div>

      <div className="flex flex-col space-y-2">
        <Button
          onClick={() => executeCommand('clay.findReferences')}
          variant="secondary"
          className="w-full justify-start"
          leftIcon={<span className="material-icons text-sm">link</span>}
        >
          Find References
          <span className="ml-auto text-xs text-vscode-descriptionForeground">
            Ctrl+Shift+R / Cmd+Shift+R
          </span>
        </Button>
        <p className="text-xs text-vscode-descriptionForeground ml-8">
          Find all references to a symbol across your codebase
        </p>
      </div>
    </div>
  );
};

export default SymbolNavigation;
