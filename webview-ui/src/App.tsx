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
    // Initialize VS Code API and determine environment
    const inVSCode = initVSCodeAPI();
    setIsVSCode(inVSCode);

    // Log the environment for debugging
    console.log(`Running in ${inVSCode ? 'VS Code webview' : 'browser'} mode`);

    // If running in browser, set a class on the body for potential styling differences
    if (!inVSCode) {
      document.body.classList.add('browser-mode');
    }

    // Check if we're in the sidebar view
    const sidebarMeta = document.querySelector('meta[name="vscode-view-type"][content="sidebar"]');
    if (sidebarMeta) {
      setIsSidebar(true);
      document.body.classList.add('vscode-sidebar-view');

      // We're in the sidebar, so we'll just use the default tab
      console.log('Running in sidebar mode');
      setInitialTab('overview');
    }
  }, []);

  // Wait until we've determined the environment before rendering
  if (isVSCode === null) {
    return <div className="loading">Loading...</div>;
  }

  // Create a common dashboard component with appropriate styling
  const dashboardComponent = <Dashboard initialTab={initialTab} isSidebar={isSidebar} />;

  // If we're in the sidebar, render just the dashboard without the layout
  if (isSidebar) {
    return (
      <TracesProvider>
        <div className="sidebar-container">{dashboardComponent}</div>
      </TracesProvider>
    );
  }

  // Otherwise, render the normal dashboard with layout
  return (
    <TracesProvider>
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
    </TracesProvider>
  );
};

export default App;
