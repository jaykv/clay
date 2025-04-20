import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import IndexedFiles from './IndexedFiles';
import CodeSearch from './CodeSearch';
import SymbolNavigation from './SymbolNavigation';
import IndexManagement from './IndexManagement';
import AugmentTabs from './AugmentTabs';

const AugmentContextEngine: React.FC = () => {
  // State for tabs and content
  const [activeTab, setActiveTab] = useState('search');
  const [showIndexedFiles, setShowIndexedFiles] = useState(false);

  // Define tabs
  const tabs = [
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'symbols', label: 'Symbols', icon: 'code' },
    { id: 'index', label: 'Index', icon: 'storage' },
    { id: 'about', label: 'About', icon: 'info' },
  ];

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  // Toggle indexed files visibility
  const toggleIndexedFiles = () => {
    setShowIndexedFiles(!showIndexedFiles);
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'search':
        return <CodeSearch />;
      case 'symbols':
        return <SymbolNavigation className="p-4" />;
      case 'index':
        return (
          <div className="p-4 space-y-6">
            <IndexManagement onToggleFilesView={toggleIndexedFiles} showFiles={showIndexedFiles} />
            {showIndexedFiles && <IndexedFiles className="mt-6" />}
          </div>
        );
      case 'about':
        return (
          <div className="p-4 space-y-4">
            <div className="p-4 border border-vscode-panel-border rounded-lg bg-vscode-button-bg bg-opacity-10">
              <h3 className="font-medium mb-2 text-vscode-button-bg">
                About Augment Context Engine
              </h3>
              <p className="text-sm text-vscode-button-bg mb-2">
                The Augment Context Engine provides powerful code intelligence features to help you
                navigate and understand your codebase.
              </p>
              <ul className="list-disc list-inside text-sm text-vscode-button-bg space-y-1">
                <li>Intelligent code search across your entire codebase</li>
                <li>Symbol definition and reference finding</li>
                <li>Integration with VS Code's language services</li>
                <li>Available as an MCP tool for AI extensions</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <h3 className="font-medium mb-2">Keyboard Shortcuts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Search Codebase</span>
                  <span className="text-xs bg-vscode-input-bg text-vscode-input-fg px-2 py-1 rounded border border-vscode-panel-border">
                    Ctrl+Shift+F / Cmd+Shift+F
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Go to Definition</span>
                  <span className="text-xs bg-vscode-input-bg text-vscode-input-fg px-2 py-1 rounded border border-vscode-panel-border">
                    Ctrl+Shift+G / Cmd+Shift+G
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Find References</span>
                  <span className="text-xs bg-vscode-input-bg text-vscode-input-fg px-2 py-1 rounded border border-vscode-panel-border">
                    Ctrl+Shift+R / Cmd+Shift+R
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Reindex Codebase</span>
                  <span className="text-xs bg-vscode-input-bg text-vscode-input-fg px-2 py-1 rounded border border-vscode-panel-border">
                    Ctrl+Shift+I / Cmd+Shift+I
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <Card title="Augment Context Engine">
      <div className="flex flex-col h-full">
        <AugmentTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex-1 overflow-auto">{renderTabContent()}</div>
      </div>
    </Card>
  );
};

export default AugmentContextEngine;
