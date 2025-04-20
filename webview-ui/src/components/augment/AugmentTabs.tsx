import React from 'react';
import { cn } from '@/utils/cn';

interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface AugmentTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

const AugmentTabs: React.FC<AugmentTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <div className={cn('border-b border-vscode-panel-border', className)}>
      <div className="flex overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={cn(
              'flex items-center px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap',
              activeTab === tab.id
                ? 'text-vscode-button-bg border-vscode-button-bg'
                : 'text-vscode-descriptionForeground border-transparent hover:text-vscode-input-fg hover:border-vscode-panel-border'
            )}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="material-icons text-sm mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AugmentTabs;
