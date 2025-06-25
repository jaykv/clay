/**
 * Indexing Tab - Main interface for personal code indexing (Augment-style)
 * Combines file selection, ignore patterns, and progress tracking
 */

import React, { useState, useEffect } from 'react';
import { FolderOpen, Filter, Activity, GitBranch } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import FileTreeSelector from './FileTreeSelector';
import IgnorePatternsList from './IgnorePatternsList';
import IndexingProgress from './IndexingProgress';
import * as personalIndexAPI from '@/lib/api/personal-index';

interface IndexingTabProps {
  className?: string;
}

// Use the types from the API
type IndexStatus = personalIndexAPI.IndexStatus;

const IndexingTab: React.FC<IndexingTabProps> = ({ className = '' }) => {
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>([]);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadIndexStatus();
    // Get workspace path from VS Code extension
    requestWorkspacePath();
  }, []);

  const requestWorkspacePath = () => {
    // Try to get workspace path from VS Code API or use a reasonable default
    // In a real VS Code extension, this would come from the extension host
    const defaultPath = '/Users/jay/Desktop/projects/ai/clay'; // Use current project as default for testing
    setWorkspacePath(defaultPath);
  };

  const loadIndexStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await personalIndexAPI.getPersonalIndexStatus();
      setIndexStatus(data);
    } catch (err) {
      console.error('Error loading index status:', err);
      setError('Failed to load index status');
    } finally {
      setLoading(false);
    }
  };

  const initializeIndex = async () => {
    try {
      setError(null);

      await personalIndexAPI.initializePersonalIndex(workspacePath);
      await loadIndexStatus();
    } catch (err) {
      console.error('Error initializing index:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize index');
    }
  };

  const startIndexing = async () => {
    try {
      setError(null);

      const fileSelection: personalIndexAPI.FileSelection = {
        selectedPaths,
        ignorePatterns,
        includePatterns: selectedPaths.length > 0 ? selectedPaths : ['**/*'],
        maxFileSize: 1000000, // 1MB
        supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.md', '.json'],
      };

      await personalIndexAPI.startIndexing(workspacePath, fileSelection);
    } catch (err) {
      console.error('Error starting indexing:', err);
      setError(err instanceof Error ? err.message : 'Failed to start indexing');
    }
  };

  const stopIndexing = async () => {
    try {
      await personalIndexAPI.stopIndexing();
    } catch (err) {
      console.error('Error stopping indexing:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop indexing');
    }
  };

  const pauseIndexing = async () => {
    // For now, pause is the same as stop
    await stopIndexing();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Loading indexing system...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Personal Code Indexing
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Augment-style semantic indexing with real-time updates
          </p>
        </div>
        
        {indexStatus?.index && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <GitBranch className="w-4 h-4" />
            <span>{indexStatus.index.branch}</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-800 dark:text-red-200 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Index Status */}
      {indexStatus && (
        <Card title="Index Status" className="mb-6">
          {!indexStatus.initialized ? (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Personal index system is not initialized
              </p>
              <Button onClick={initializeIndex} variant="primary">
                Initialize Index System
              </Button>
            </div>
          ) : indexStatus.index ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Files</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {indexStatus.index.metadata.totalFiles}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Chunks</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {indexStatus.index.metadata.totalChunks}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
                  {indexStatus.index.metadata.status}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Last Updated</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(indexStatus.index.metadata.lastUpdated)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No index found for current workspace
              </p>
              <Button onClick={initializeIndex} variant="primary">
                Create New Index
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Main Content */}
      {indexStatus?.initialized && (
        <Tabs defaultValue="files" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              File Selection
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Ignore Patterns
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Progress
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-4">
            <Card title="Select Files to Index">
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose which files and folders to include in the semantic index.
                  Selected items will be parsed and embedded for intelligent search.
                </p>
                
                <FileTreeSelector
                  workspacePath={workspacePath}
                  onSelectionChange={setSelectedPaths}
                />

                {selectedPaths.length > 0 && (
                  <div className="mt-4">
                    <Button
                      onClick={startIndexing}
                      variant="primary"
                      disabled={!indexStatus?.initialized}
                    >
                      Start Indexing ({selectedPaths.length} items)
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <Card title="Ignore Patterns">
              <IgnorePatternsList
                workspacePath={workspacePath}
                onPatternsChange={setIgnorePatterns}
              />
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-4">
            <Card title="Indexing Progress">
              <IndexingProgress
                workspacePath={workspacePath}
                onStart={startIndexing}
                onStop={stopIndexing}
                onPause={pauseIndexing}
              />
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default IndexingTab;
