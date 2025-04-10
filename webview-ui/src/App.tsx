import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import { initVSCodeAPI } from '@/utils/vscode';

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
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [navigate, location]);

  return null;
};

const App: React.FC = () => {
  const [isVSCode, setIsVSCode] = useState<boolean | null>(null);

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
  }, []);

  // Wait until we've determined the environment before rendering
  if (isVSCode === null) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <DashboardLayout>
        <NavigationHandler />
        {!isVSCode && (
          <div className="bg-blue-100 dark:bg-blue-900 p-2 mb-4 rounded text-sm">
            Running in standalone browser mode. Server controls are disabled.
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DashboardLayout>
    </Router>
  );
};

export default App;
