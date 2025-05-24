import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

interface TracingConfig {
  enabled: boolean;
  detailedBodyCapture: boolean;
  detailedSSECapture: boolean;
  maxBodySize: number;
  maxResponseSize: number;
  maxStreamSize: number;
  excludePaths: string[];
}

const TracingControls: React.FC = () => {
  const [config, setConfig] = useState<TracingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tracing configuration
  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/traces/config');
      if (!response.ok) {
        throw new Error('Failed to fetch tracing config');
      }
      const data = await response.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle detailed body capture
  const toggleBodyCapture = async () => {
    try {
      setUpdating(true);
      const response = await fetch('/api/traces/config/toggle-body-capture', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to toggle body capture');
      }
      const data = await response.json();
      setConfig(prev => prev ? { ...prev, detailedBodyCapture: data.detailedBodyCapture } : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUpdating(false);
    }
  };

  // Toggle detailed SSE capture
  const toggleSSECapture = async () => {
    try {
      setUpdating(true);
      const response = await fetch('/api/traces/config/toggle-sse-capture', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to toggle SSE capture');
      }
      const data = await response.json();
      setConfig(prev => prev ? { ...prev, detailedSSECapture: data.detailedSSECapture } : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUpdating(false);
    }
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  if (loading) {
    return (
      <Card title="Tracing Configuration">
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
          <span className="ml-2">Loading configuration...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Tracing Configuration">
        <div className="text-red-500 py-4">
          <p>Error: {error}</p>
          <Button onClick={loadConfig} className="mt-2" size="sm">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card title="Tracing Configuration">
        <div className="py-4">No configuration available</div>
      </Card>
    );
  }

  return (
    <Card title="Tracing Configuration">
      <div className="space-y-6">
        {/* Performance Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Performance Impact
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <p>
                  Detailed body/SSE capture is disabled by default for optimal performance.
                  Enable only when debugging specific LLM calls.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Detailed Body Capture</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Capture full request/response bodies for debugging
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={config.detailedBodyCapture ? 'success' : 'secondary'}>
                {config.detailedBodyCapture ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch
                checked={config.detailedBodyCapture}
                onCheckedChange={toggleBodyCapture}
                disabled={updating}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Detailed SSE/Streaming Capture</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Capture streaming responses (Server-Sent Events)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={config.detailedSSECapture ? 'success' : 'secondary'}>
                {config.detailedSSECapture ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch
                checked={config.detailedSSECapture}
                onCheckedChange={toggleSSECapture}
                disabled={updating}
              />
            </div>
          </div>
        </div>

        {/* Configuration Details */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Current Limits</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Max Body Size:</span>
              <span className="ml-2 font-mono">{formatSize(config.maxBodySize)}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Max Response Size:</span>
              <span className="ml-2 font-mono">{formatSize(config.maxResponseSize)}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Max Stream Size:</span>
              <span className="ml-2 font-mono">{formatSize(config.maxStreamSize)}</span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Tracing Status:
            </span>
            <Badge variant={config.enabled ? 'success' : 'danger'}>
              {config.enabled ? 'Active' : 'Disabled'}
            </Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-t pt-4">
          <div className="flex space-x-2">
            <Button
              onClick={loadConfig}
              variant="secondary"
              size="sm"
              disabled={updating}
            >
              Refresh
            </Button>
            {updating && (
              <div className="flex items-center text-sm text-gray-500">
                <Spinner size="sm" />
                <span className="ml-2">Updating...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TracingControls;
