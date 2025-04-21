import { createContext, useContext, useState, ReactNode } from 'react';

interface TabContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Create the context with a default value
const TabContext = createContext<TabContextType | undefined>(undefined);

// Provider component that wraps your app and makes the tab state available to any child component
export function TabProvider({ children, initialTab = 'overview' }: { children: ReactNode, initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // The value that will be given to the context
  const value = { activeTab, setActiveTab };
  
  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

// Custom hook that shorthands the context
export function useTab() {
  const context = useContext(TabContext);
  
  if (context === undefined) {
    throw new Error('useTab must be used within a TabProvider');
  }
  
  return context;
}
