/**
 * Indexing Progress - Real-time progress tracking for code indexing (Augment-style)
 */

import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import * as personalIndexAPI from '@/lib/api/personal-index';

// Use the types from the API
type IndexingProgress = personalIndexAPI.IndexingProgress;

interface IndexingProgressProps {
  workspacePath: string;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  className?: string;
}

const IndexingProgress: React.FC<IndexingProgressProps> = ({
  workspacePath: _workspacePath,
  onStart,
  onStop,
  onPause,
  className = '',
}) => {
  const [progress, setProgress] = useState<IndexingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poll for progress updates
  useEffect(() => {
    const pollProgress = async () => {
      try {
        const data = await personalIndexAPI.getIndexingProgress();
        setProgress(data.progress);
        setError(null);
      } catch (err) {
        console.error('Error polling progress:', err);
        setError('Failed to get progress updates');
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    pollProgress();

    // Set up polling interval
    const interval = setInterval(pollProgress, 1000); // Poll every second

    return () => clearInterval(interval);
  }, []);

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getElapsedTime = (): string => {
    if (!progress?.startTime) return '0s';
    return formatTime(Date.now() - progress.startTime);
  };

  const getStatusIcon = () => {
    if (!progress) return null;

    switch (progress.status) {
      case 'indexing':
      case 'updating':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    if (!progress) return 'Not initialized';

    switch (progress.status) {
      case 'idle':
        return 'Ready to index';
      case 'initializing':
        return 'Initializing...';
      case 'indexing':
        return 'Indexing files...';
      case 'updating':
        return 'Updating index...';
      case 'paused':
        return 'Indexing paused';
      case 'error':
        return 'Indexing failed';
      case 'completed':
        return 'Indexing completed';
      default:
        return progress.status;
    }
  };

  const canStart = progress?.status === 'idle' || progress?.status === 'paused' || progress?.status === 'error';
  const canPause = progress?.status === 'indexing' || progress?.status === 'updating';
  const canStop = progress?.status === 'indexing' || progress?.status === 'updating' || progress?.status === 'paused';

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Loading progress...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Indexing Progress
        </h3>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && progress.totalFiles > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              {progress.filesProcessed} of {progress.totalFiles} files
            </span>
            <span>{Math.round(progress.percentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Current File */}
      {progress?.currentFile && (
        <div className="text-sm">
          <span className="text-gray-600 dark:text-gray-400">Processing: </span>
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
            {progress.currentFile}
          </code>
        </div>
      )}

      {/* Operation Details */}
      {progress?.operation && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {progress.operation.type === 'bulk' ? 'Bulk Indexing' : 
             progress.operation.type === 'incremental' ? 'Incremental Update' : 
             'File Change Update'}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            {progress.operation.description}
          </div>
        </div>
      )}

      {/* Timing Information */}
      {progress && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Elapsed: </span>
            <span className="font-mono">{getElapsedTime()}</span>
          </div>
          {progress.estimatedTimeRemaining && (
            <div>
              <span className="text-gray-600 dark:text-gray-400">Remaining: </span>
              <span className="font-mono">{formatTime(progress.estimatedTimeRemaining)}</span>
            </div>
          )}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onStart}
          variant="primary"
          size="sm"
          leftIcon={<Play className="w-4 h-4" />}
          disabled={!canStart}
        >
          {progress?.status === 'paused' ? 'Resume' : 'Start'}
        </Button>
        
        <Button
          onClick={onPause}
          variant="secondary"
          size="sm"
          leftIcon={<Pause className="w-4 h-4" />}
          disabled={!canPause}
        >
          Pause
        </Button>
        
        <Button
          onClick={onStop}
          variant="secondary"
          size="sm"
          leftIcon={<Square className="w-4 h-4" />}
          disabled={!canStop}
        >
          Stop
        </Button>
      </div>

      {/* Errors */}
      {progress?.errors && progress.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-900 dark:text-red-100">
            Errors ({progress.errors.length})
          </h4>
          <div className="max-h-32 overflow-auto space-y-1">
            {progress.errors.map((error, index) => (
              <div
                key={index}
                className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-sm"
              >
                <div className="font-medium text-red-900 dark:text-red-100">
                  {error.filePath}
                </div>
                <div className="text-red-700 dark:text-red-300">
                  {error.message}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {error.type} • {new Date(error.timestamp).toLocaleTimeString()}
                  {error.recoverable && ' • Recoverable'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default IndexingProgress;
