import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { postMessage } from '@/utils/vscode';

interface FileDetailsProps {
  filePath: string;
  onClose: () => void;
}

interface FileSymbol {
  name: string;
  type: string;
  startLine: number;
  endLine: number;
  parent?: string;
  signature?: string;
}

interface FileData {
  path: string;
  content: string;
  language: string;
  size: number;
  lastModified: number;
  symbols: FileSymbol[];
}

const FileDetails: React.FC<FileDetailsProps> = ({ filePath, onClose }) => {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch file details
  useEffect(() => {
    const fetchFileDetails = async () => {
      setLoading(true);
      try {
        const API_BASE_URL =
          typeof window.acquireVsCodeApi === 'function' ? 'http://localhost:3000' : '';
        const response = await fetch(
          `${API_BASE_URL}/api/augment/files/${encodeURIComponent(filePath)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch file details: ${response.statusText}`);
        }

        const data = await response.json();
        setFileData({
          path: data.file.path,
          content: data.file.content,
          language: data.file.language,
          size: data.file.size,
          lastModified: data.file.lastModified,
          symbols: data.symbols || [],
        });
      } catch (err) {
        console.error('Error fetching file details:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchFileDetails();
  }, [filePath]);

  // Navigate to file in VSCode
  const openFile = (startLine: number = 1, endLine?: number) => {
    if (typeof window.acquireVsCodeApi === 'function') {
      postMessage({
        command: 'clay.openFile',
        filePath,
        startLine,
        endLine: endLine || startLine,
      });
    } else {
      alert(`Would open ${filePath} at line ${startLine} in VS Code`);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Get symbol icon based on type
  const getSymbolIcon = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'class':
        return 'class';
      case 'method':
      case 'function':
        return 'functions';
      case 'variable':
        return 'data_object';
      case 'interface':
        return 'integration_instructions';
      case 'enum':
        return 'list';
      case 'property':
        return 'label';
      default:
        return 'code';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium truncate">{filePath}</h3>
        <Button variant="secondary" size="sm" onClick={onClose}>
          <span className="material-icons">close</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <Spinner size="lg" />
          <span className="ml-2">Loading file details...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-md m-4">
          <p className="font-medium">Error loading file</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : fileData ? (
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
              <div className="text-sm font-medium">Language</div>
              <div className="mt-1">
                <Badge>{fileData.language || 'Unknown'}</Badge>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
              <div className="text-sm font-medium">Size</div>
              <div className="text-sm mt-1">{formatFileSize(fileData.size)}</div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md md:col-span-2">
              <div className="text-sm font-medium">Last Modified</div>
              <div className="text-sm mt-1">{formatDate(fileData.lastModified)}</div>
            </div>
          </div>

          <div className="mb-4">
            <Button
              variant="primary"
              onClick={() => openFile()}
              leftIcon={<span className="material-icons text-sm">open_in_new</span>}
            >
              Open in Editor
            </Button>
          </div>

          {fileData.symbols.length > 0 && (
            <div>
              <h4 className="text-md font-medium mb-2">Symbols</h4>
              <div className="border rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Symbol
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Line
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                    {fileData.symbols.map((symbol, index) => (
                      <tr
                        key={`symbol-${index}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center">
                            <span className="material-icons text-gray-500 dark:text-gray-400 mr-2">
                              {getSymbolIcon(symbol.type)}
                            </span>
                            <div>
                              <div className="font-medium">{symbol.name}</div>
                              {symbol.signature && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {symbol.signature}
                                </div>
                              )}
                              {symbol.parent && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  in {symbol.parent}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          <Badge variant="outline">{symbol.type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {symbol.startLine}
                          {symbol.endLine > symbol.startLine && `-${symbol.endLine}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openFile(symbol.startLine, symbol.endLine)}
                          >
                            Go to
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default FileDetails;
