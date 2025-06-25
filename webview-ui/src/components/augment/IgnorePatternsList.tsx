/**
 * Ignore Patterns List - Manage file/folder ignore patterns for indexing
 */

import React, { useState, useEffect } from 'react';
import { Plus, X, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import * as personalIndexAPI from '@/lib/api/personal-index';

interface IgnorePatternsListProps {
  workspacePath: string;
  onPatternsChange: (patterns: string[]) => void;
  className?: string;
}

const DEFAULT_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  '.vscode/**',
  '*.log',
  '.env*',
  'coverage/**',
  '.nyc_output/**',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/package-lock.json',
  '**/yarn.lock',
];

const IgnorePatternsList: React.FC<IgnorePatternsListProps> = ({
  workspacePath,
  onPatternsChange,
  className = '',
}) => {
  const [patterns, setPatterns] = useState<string[]>([]);
  const [newPattern, setNewPattern] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load patterns on mount
  useEffect(() => {
    loadPatterns();
  }, [workspacePath]);

  const loadPatterns = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await personalIndexAPI.getIgnorePatterns(workspacePath);
      setPatterns(data.patterns || DEFAULT_PATTERNS);
    } catch (err) {
      console.error('Error loading ignore patterns:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPatterns(DEFAULT_PATTERNS);
    } finally {
      setLoading(false);
    }
  };

  const savePatterns = async (newPatterns: string[]) => {
    try {
      setSaving(true);
      setError(null);

      await personalIndexAPI.updateIgnorePatterns(workspacePath, newPatterns);
      onPatternsChange(newPatterns);
    } catch (err) {
      console.error('Error saving ignore patterns:', err);
      setError(err instanceof Error ? err.message : 'Failed to save patterns');
    } finally {
      setSaving(false);
    }
  };

  const addPattern = () => {
    if (!newPattern.trim()) return;

    const trimmedPattern = newPattern.trim();
    if (patterns.includes(trimmedPattern)) {
      setError('Pattern already exists');
      return;
    }

    const newPatterns = [...patterns, trimmedPattern];
    setPatterns(newPatterns);
    setNewPattern('');
    savePatterns(newPatterns);
  };

  const removePattern = (index: number) => {
    const newPatterns = patterns.filter((_, i) => i !== index);
    setPatterns(newPatterns);
    savePatterns(newPatterns);
  };

  const resetToDefaults = () => {
    setPatterns(DEFAULT_PATTERNS);
    savePatterns(DEFAULT_PATTERNS);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addPattern();
    }
  };

  const validatePattern = (pattern: string): boolean => {
    // Basic validation for glob patterns
    if (!pattern.trim()) return false;
    
    // Check for invalid characters
    const invalidChars = ['<', '>', '|', '"'];
    return !invalidChars.some(char => pattern.includes(char));
  };

  const getPatternDescription = (pattern: string): string => {
    if (pattern.endsWith('/**')) {
      return 'Ignores directory and all contents';
    }
    if (pattern.startsWith('**/')) {
      return 'Ignores files in any directory';
    }
    if (pattern.includes('*')) {
      return 'Wildcard pattern';
    }
    return 'Exact match';
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Loading ignore patterns...
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
          Ignore Patterns
        </h3>
        <Button
          onClick={resetToDefaults}
          variant="secondary"
          size="sm"
          leftIcon={<RotateCcw className="w-4 h-4" />}
          disabled={saving}
        >
          Reset to Defaults
        </Button>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Files and folders matching these patterns will be excluded from indexing.
        Use glob patterns like <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">**/*.log</code> or{' '}
        <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">node_modules/**</code>.
      </p>

      {/* Add new pattern */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add ignore pattern (e.g., *.log, temp/**)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={saving}
        />
        <Button
          onClick={addPattern}
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          disabled={!newPattern.trim() || !validatePattern(newPattern) || saving}
        >
          Add
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {error}
        </div>
      )}

      {/* Patterns list */}
      <div className="space-y-2">
        {patterns.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
            No ignore patterns configured
          </div>
        ) : (
          <div className="max-h-64 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            {patterns.map((pattern, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0
                         hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {pattern}
                    </code>
                    {DEFAULT_PATTERNS.includes(pattern) && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {getPatternDescription(pattern)}
                  </div>
                </div>
                <button
                  onClick={() => removePattern(index)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 
                           hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  disabled={saving}
                  title="Remove pattern"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pattern count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} configured
        {saving && (
          <span className="ml-2 text-blue-600 dark:text-blue-400">
            Saving...
          </span>
        )}
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
        <strong>Pattern Examples:</strong>
        <ul className="mt-1 space-y-1">
          <li><code>*.log</code> - All .log files</li>
          <li><code>temp/**</code> - Everything in temp directory</li>
          <li><code>**/node_modules/**</code> - node_modules in any directory</li>
          <li><code>.env*</code> - All files starting with .env</li>
        </ul>
      </div>
    </div>
  );
};

export default IgnorePatternsList;
