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
}

const ServerStatus: React.FC<ServerStatusProps> = ({
  name,
  description,
  isRunning,
  port,
  startCommand,
  stopCommand,
  disableControls = false,
}) => {
  const handleStart = () => {
    postMessage({ command: startCommand });
  };

  const handleStop = () => {
    postMessage({ command: stopCommand });
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex-1">
        <div className="flex items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{name}</h3>
          <div className="ml-2 flex-shrink-0 flex">
            <p
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                isRunning
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {isRunning ? 'Running' : 'Stopped'}
            </p>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        {isRunning && port && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Running on port: <span className="font-mono">{port}</span>
          </p>
        )}
      </div>
      <div className="ml-4">
        {disableControls ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
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
