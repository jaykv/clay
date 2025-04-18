import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { reindexCodebase, getIndexStatus } from '@/lib/api/augment';

interface IndexManagementProps {
  onToggleFilesView: () => void;
  showFiles: boolean;
  className?: string;
}

interface IndexStatus {
  totalFiles: number;
  indexedFiles: number;
  lastUpdated: number;
  isIndexing: boolean;
}

const IndexManagement: React.FC<IndexManagementProps> = ({
  onToggleFilesView,
  showFiles,
  className = '',
}) => {
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);

  // Fetch index status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await getIndexStatus();
      setStatus(data.status);
      setError(null);
    } catch (err) {
      console.error('Error fetching index status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch status on component mount
  useEffect(() => {
    fetchStatus();

    // Set up polling for status updates
    const intervalId = setInterval(fetchStatus, 5000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Handle reindex button click
  const handleReindex = async () => {
    try {
      setIsReindexing(true);
      await reindexCodebase();
      // Start polling for status updates more frequently during reindexing
      const pollId = setInterval(async () => {
        await fetchStatus();
        const data = await getIndexStatus();
        if (!data.status.isIndexing) {
          clearInterval(pollId);
          setIsReindexing(false);
        }
      }, 1000);
    } catch (err) {
      console.error('Error reindexing codebase:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsReindexing(false);
    }
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          onClick={handleReindex}
          variant="secondary"
          isLoading={isReindexing}
          leftIcon={<span className="material-icons text-sm">refresh</span>}
          disabled={isReindexing}
        >
          Reindex Codebase
        </Button>

        <Button
          onClick={onToggleFilesView}
          variant="secondary"
          leftIcon={
            <span className="material-icons text-sm">
              {showFiles ? 'visibility_off' : 'visibility'}
            </span>
          }
        >
          {showFiles ? 'Hide Indexed Files' : 'Show Indexed Files'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <Spinner size="sm" />
          <span>Loading index status...</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : status ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
            <div className="text-sm font-medium">Index Status</div>
            <div className="flex items-center mt-1">
              {status.isIndexing ? (
                <Badge variant="warning" className="flex items-center">
                  <Spinner size="sm" className="mr-1" />
                  Indexing...
                </Badge>
              ) : (
                <Badge variant="success">Ready</Badge>
              )}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
            <div className="text-sm font-medium">Files</div>
            <div className="text-sm mt-1">
              {status.indexedFiles} / {status.totalFiles} indexed
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md md:col-span-2">
            <div className="text-sm font-medium">Last Updated</div>
            <div className="text-sm mt-1">
              {status.lastUpdated ? formatDate(status.lastUpdated) : 'Never'}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default IndexManagement;
