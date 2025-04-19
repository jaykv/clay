import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import CodeSearch from './CodeSearch';
import SymbolNavigation from './SymbolNavigation';
import IndexManagement from './IndexManagement';
import IndexedFiles from './IndexedFiles';

const AugmentSidebarView: React.FC = () => {
  // State for tabs and content
  const [activeTab, setActiveTab] = useState('search');
  const [showIndexedFiles, setShowIndexedFiles] = useState(false);

  // Toggle indexed files visibility
  const toggleIndexedFiles = () => {
    setShowIndexedFiles(!showIndexedFiles);
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-2">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-medium">Augment Context Engine</h2>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="w-full justify-start bg-transparent p-0 mb-3">
          <TabsTrigger
            value="search"
            className="text-xs py-1 px-2 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
          </TabsTrigger>
          <TabsTrigger
            value="symbols"
            className="text-xs py-1 px-2 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Symbols
          </TabsTrigger>
          <TabsTrigger
            value="index"
            className="text-xs py-1 px-2 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11h6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15h6" />
            </svg>
            Index
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="flex-1 overflow-auto m-0 p-0">
          <CodeSearch />
        </TabsContent>

        <TabsContent value="symbols" className="flex-1 overflow-auto m-0 p-0">
          <SymbolNavigation className="p-2" />
        </TabsContent>

        <TabsContent value="index" className="flex-1 overflow-auto m-0 p-0">
          <div className="p-2 space-y-4">
            <IndexManagement onToggleFilesView={toggleIndexedFiles} showFiles={showIndexedFiles} />
            {showIndexedFiles && <IndexedFiles className="mt-4" />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AugmentSidebarView;
