import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import { initVSCodeAPI } from '@/utils/vscode';
import { TracesProvider } from '@/contexts/TracesContext';
import { TabProvider } from '@/contexts/TabContext';
import { onThemeChange, getVSCodeThemeType } from '@/utils/theme';
import { applyContrastText } from '@/utils/contrast';
import { initializeContext } from '@/utils/context-detection';

// Component to handle navigation messages from the extension
const NavigationHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Listen for messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      // Handle navigation messages
      if (message.command === 'navigate') {
        if (message.route === '/proxy-routes') {
          // Instead of navigating to a separate route, we'll dispatch a custom event
          // that the Dashboard component can listen for to switch to the routes tab
          window.dispatchEvent(new CustomEvent('switchTab', { detail: { tab: 'routes' } }));
        } else if (location.pathname !== message.route) {
          navigate(message.route);
        }
      }

      // Handle direct tab switching
      if (message.command === 'switchTab' && message.tab) {
        window.dispatchEvent(new CustomEvent('switchTab', { detail: { tab: message.tab } }));
      }

      // Handle custom event dispatching
      if (message.command === 'dispatchCustomEvent' && message.eventName) {
        window.dispatchEvent(new CustomEvent(message.eventName, { detail: message.detail }));
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [navigate, location]);

  return null;
};

const App: React.FC = () => {
  const [isVSCode, setIsVSCode] = useState<boolean | null>(null);
  const [isSidebar, setIsSidebar] = useState<boolean>(false);
  const [initialTab, setInitialTab] = useState<string>('overview');

  useEffect(() => {
    // Initialize context detection first
    const detectedContext = initializeContext();

    // Initialize VS Code API and determine environment
    const inVSCode = initVSCodeAPI();
    setIsVSCode(inVSCode);

    // Log the environment for debugging
    console.log(`Running in ${inVSCode ? 'VS Code webview' : 'browser'} mode`);
    console.log(`Detected context: ${detectedContext}`);

    // If running in browser, set a class on the body for potential styling differences
    if (!inVSCode) {
      document.body.classList.add('browser-mode');
    }

    // Check if we're in the sidebar view
    console.log('Checking if running in sidebar view...');
    console.log('Body classes:', document.body.className);

    // Try multiple methods to detect sidebar view
    const sidebarMeta = document.querySelector('meta[name="vscode-view-type"][content="sidebar"]');
    const hasSidebarClass = document.body.classList.contains('vscode-sidebar-view');

    console.log('Sidebar meta element:', sidebarMeta);
    console.log('Has sidebar class:', hasSidebarClass);

    // Check if the body already has the sidebar class (might be added by the extension)
    if (sidebarMeta || hasSidebarClass) {
      setIsSidebar(true);
      document.body.classList.add('vscode-sidebar-view'); // Ensure the class is added

      // We're in the sidebar, so we'll just use the default tab
      console.log('Running in sidebar mode');
      setInitialTab('overview');
    } else {
      // Additional check - look at the window size, sidebars are typically narrow
      const isNarrowViewport = window.innerWidth < 500;
      console.log('Window width:', window.innerWidth, 'Is narrow viewport:', isNarrowViewport);

      if (isNarrowViewport && inVSCode) {
        console.log('Detected narrow viewport in VS Code, assuming sidebar view');
        setIsSidebar(true);
        document.body.classList.add('vscode-sidebar-view');
        setInitialTab('overview');
      } else {
        console.log('Not running in sidebar mode');
      }
    }
  }, []);

  // Set up theme change listener in a separate useEffect
  useEffect(() => {
    if (isVSCode) {
      // Log the current VS Code theme
      const themeType = getVSCodeThemeType();
      console.log(`Current VS Code theme type: ${themeType}`);

      // Apply contrast to the body element
      applyContrastText(document.body, 'editor-background');

      // Set up theme change listener
      const removeThemeListener = onThemeChange(() => {
        const newThemeType = getVSCodeThemeType();
        console.log(`VS Code theme changed to: ${newThemeType}`);

        // Re-apply contrast when theme changes
        applyContrastText(document.body, 'editor-background');
      });

      // Clean up the listener when component unmounts
      return () => removeThemeListener();
    }
  }, [isVSCode]);

  // Wait until we've determined the environment before rendering
  if (isVSCode === null) {
    return <div className="loading">Loading...</div>;
  }

  // Create a common dashboard component with appropriate styling
  const dashboardComponent = <Dashboard initialTab={initialTab} isSidebar={isSidebar} />;

  // Log the current state for debugging
  console.log('Rendering with isSidebar:', isSidebar, 'initialTab:', initialTab);

  // If we're in the sidebar, render just the dashboard without the layout
  if (isSidebar) {
    console.log('Rendering sidebar view');
    return (
      <TracesProvider>
        <TabProvider initialTab={initialTab}>
          <div className="sidebar-container">{dashboardComponent}</div>
        </TabProvider>
      </TracesProvider>
    );
  }

  // Otherwise, render the normal dashboard with layout
  return (
    <TracesProvider>
      <TabProvider initialTab={initialTab}>
        <Router>
          <DashboardLayout>
            <NavigationHandler />
            {!isVSCode && (
              <div className="bg-blue-100 dark:bg-blue-900 p-2 mb-4 rounded text-sm">
                Running in standalone browser mode. Server controls are disabled.
              </div>
            )}
            <Routes>
              <Route path="/" element={dashboardComponent} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DashboardLayout>
        </Router>
      </TabProvider>
    </TracesProvider>
  );
};

export default App;
