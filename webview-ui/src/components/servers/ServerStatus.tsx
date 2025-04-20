import React from 'react';
import Button from '@/components/ui/Button';
import { postMessage } from '@/utils/vscode';

interface ServerStatusProps {
  name: string;
  description: string;
  isRunning: boolean;
  port?: number;
  startCommand: string;
  stopCommand: string;
  // Optional flag to disable controls when running in browser mode
  disableControls?: boolean;
  // Optional children to render below the server status
  children?: React.ReactNode;
  // Optional admin endpoint URL for stopping the server directly
  adminStopUrl?: string;
  // Callback for when stop action completes (for immediate health check)
  onStopComplete?: () => void;
  // Callback for when start action is initiated (for immediate UI feedback)
  onStartInitiated?: () => void;
}

const ServerStatus: React.FC<ServerStatusProps> = ({
  name,
  description,
  isRunning,
  port,
  startCommand,
  stopCommand,
  disableControls = false,
  children,
  adminStopUrl,
  onStopComplete,
  onStartInitiated,
}) => {
  const handleStart = () => {
    // Call the onStartInitiated callback for immediate UI feedback
    if (onStartInitiated) {
      onStartInitiated();
    }

    // Send the command to start the server
    postMessage({ command: startCommand });
  };

  const handleStop = async () => {
    // If we have an admin stop URL, use it directly
    if (adminStopUrl && isRunning) {
      try {
        // Import the stopServer function dynamically to avoid circular dependencies
        const { stopServer } = await import('@/lib/api/servers');
        const success = await stopServer(adminStopUrl);

        if (success) {
          console.log(`Server ${name} is stopping via admin endpoint`);

          // Call the onStopComplete callback after a short delay to allow the server to stop
          if (onStopComplete) {
            console.log(`Scheduling health check for ${name} after stop action via admin endpoint`);
            // Wait a short time before checking health to allow the server to start shutting down
            setTimeout(onStopComplete, 300);
          }

          return;
        }
      } catch (error) {
        console.error(`Error stopping server ${name} via admin endpoint:`, error);
        // Fall back to VS Code command if direct stop fails or is not available
        postMessage({ command: stopCommand });
      }
    } else if (isRunning) {
      // Send the command to stop the server
      postMessage({ command: stopCommand });
    }

    // Call the onStopComplete callback after a short delay to allow the server to stop
    // Only if we were actually running (to avoid unnecessary health checks)
    if (onStopComplete && isRunning) {
      console.log(`Scheduling health check for ${name} after stop action`);
      // Wait a short time before checking health to allow the server to start shutting down
      setTimeout(onStopComplete, 300);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border border-vscode-panel-border rounded-lg bg-vscode-bg text-vscode-fg shadow-sm">
      <div className="flex-1">
        <div className="flex items-center">
          <h3 className="text-lg font-medium text-vscode-fg">{name}</h3>
          <div className="ml-2 flex-shrink-0 flex">
            <p
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                isRunning
                  ? 'bg-vscode-button-bg text-vscode-button-fg'
                  : 'bg-vscode-input-bg text-vscode-input-foreground'
              }`}
            >
              {isRunning ? 'Running' : 'Stopped'}
            </p>
          </div>
        </div>
        <p className="mt-1 text-sm text-vscode-descriptionForeground">{description}</p>
        {isRunning && port && (
          <p className="mt-1 text-sm text-vscode-descriptionForeground">
            Running on port: <span className="font-mono">{port}</span>
          </p>
        )}
        {children}
      </div>
      <div className="ml-4">
        {disableControls ? (
          <div className="text-xs text-vscode-descriptionForeground italic">
            {isRunning ? 'Running in browser mode' : 'Controls disabled'}
          </div>
        ) : isRunning ? (
          <Button variant="danger" size="sm" onClick={handleStop}>
            Stop
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleStart}>
            Start
          </Button>
        )}
      </div>
    </div>
  );
};

export default ServerStatus;
