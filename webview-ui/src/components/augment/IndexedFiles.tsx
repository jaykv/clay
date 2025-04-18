import React, { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { getIndexedFiles, getLanguages, IndexedFile, Pagination } from '@/lib/api/augment';
import { postMessage } from '@/utils/vscode';
import FileDetails from './FileDetails';

interface IndexedFilesProps {
  className?: string;
}

const IndexedFiles: React.FC<IndexedFilesProps> = ({ className = '' }) => {
  // State for files and loading
  const [files, setFiles] = useState<IndexedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 100,
    totalPages: 0,
  });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Debounce search query to avoid too many API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const languages = await getLanguages();
        setLanguages(languages);
      } catch (err) {
        console.error('Error fetching languages:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    fetchLanguages();
  }, []);

  // Fetch files when search query or language changes
  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getIndexedFiles(
          pagination.page,
          pagination.limit,
          debouncedSearchQuery || undefined,
          selectedLanguage || undefined
        );

        setFiles(data.files);
        setPagination(data.pagination);
      } catch (err) {
        console.error('Error fetching files:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [debouncedSearchQuery, selectedLanguage, pagination.page, pagination.limit]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Reset to first page when search changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle language selection change
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLanguage(e.target.value);
    // Reset to first page when language changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle pagination
  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format last modified date
  const formatLastModified = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Get file icon based on language
  const getFileIcon = (language: string): string => {
    switch (language?.toLowerCase()) {
      case 'javascript':
        return 'js';
      case 'typescript':
        return 'ts';
      case 'python':
        return 'py';
      case 'java':
        return 'java';
      case 'c#':
      case 'csharp':
        return 'cs';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'markdown':
        return 'md';
      default:
        return 'code';
    }
  };

  // Open file in VSCode
  const openFile = (filePath: string) => {
    if (typeof window.acquireVsCodeApi === 'function') {
      postMessage({
        command: 'clay.openFile',
        filePath,
      });
    } else {
      // In browser mode, show file details
      setSelectedFile(filePath);
    }
  };

  return (
    <div className={className}>
      {selectedFile ? (
        <FileDetails filePath={selectedFile} onClose={() => setSelectedFile(null)} />
      ) : (
        <Card title="Indexed Files">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full"
                  leftIcon={<span className="material-icons text-sm">search</span>}
                />
              </div>
              <div className="w-full md:w-48">
                <Select value={selectedLanguage} onChange={handleLanguageChange} className="w-full">
                  <option value="">All Languages</option>
                  {languages.map(lang => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-md">
                <p className="font-medium">Error loading files</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center p-8">
                <Spinner size="lg" />
                <span className="ml-2">Loading files...</span>
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {files.length} of {pagination.total} files
                </div>

                <div className="border rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          File
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Language
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Last Modified
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                      {files.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-4 text-center text-gray-500 dark:text-gray-400"
                          >
                            No files found
                          </td>
                        </tr>
                      ) : (
                        files.map(file => (
                          <tr key={file.path} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              <div className="flex items-center">
                                <span className="material-icons text-gray-500 dark:text-gray-400 mr-2">
                                  {getFileIcon(file.language)}
                                </span>
                                <span className="truncate max-w-xs">{file.path}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {file.language ? (
                                <Badge variant="outline">{file.language}</Badge>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-600">Unknown</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {formatLastModified(file.lastModified)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openFile(file.path)}
                                leftIcon={
                                  <span className="material-icons text-xs">open_in_new</span>
                                }
                              >
                                Open
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {pagination.totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Page {pagination.page} of {pagination.totalPages}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={handlePrevPage}
                        disabled={pagination.page === 1}
                        variant="secondary"
                        size="sm"
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={handleNextPage}
                        disabled={pagination.page === pagination.totalPages}
                        variant="secondary"
                        size="sm"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default IndexedFiles;
