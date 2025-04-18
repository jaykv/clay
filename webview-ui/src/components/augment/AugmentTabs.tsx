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
    <div className={cn('border-b border-gray-200 dark:border-gray-700', className)}>
      <div className="flex overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={cn(
              'flex items-center px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap',
              activeTab === tab.id
                ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
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
