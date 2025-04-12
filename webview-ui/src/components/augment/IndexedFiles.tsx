import React, { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';

// Types for the API responses
interface IndexedFile {
  path: string;
  language: string;
  size: number;
  lastModified: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FilesResponse {
  files: IndexedFile[];
  pagination: Pagination;
}

interface LanguagesResponse {
  languages: string[];
}

const IndexedFiles: React.FC = () => {
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
    totalPages: 0
  });

  // Debounce search query to avoid too many API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch('/api/augment/languages');
        if (!response.ok) {
          throw new Error(`Failed to fetch languages: ${response.statusText}`);
        }
        const data: LanguagesResponse = await response.json();
        setLanguages(data.languages);
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
        // Build query parameters
        const params = new URLSearchParams();
        params.append('page', pagination.page.toString());
        params.append('limit', pagination.limit.toString());

        if (debouncedSearchQuery) {
          params.append('filter', debouncedSearchQuery);
        }

        if (selectedLanguage) {
          params.append('language', selectedLanguage);
        }

        const response = await fetch(`/api/augment/files?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch files: ${response.statusText}`);
        }

        const data: FilesResponse = await response.json();
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
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format last modified date
  const formatLastModified = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Get file icon based on language
  const getFileIcon = (language: string): string => {
    switch (language.toLowerCase()) {
      case 'javascript':
        return '📄 js';
      case 'typescript':
        return '📄 ts';
      case 'python':
        return '📄 py';
      case 'java':
        return '📄 java';
      case 'c#':
      case 'csharp':
        return '📄 cs';
      case 'html':
        return '📄 html';
      case 'css':
        return '📄 css';
      case 'json':
        return '📄 json';
      case 'markdown':
        return '📄 md';
      default:
        return '📄';
    }
  };

  return (
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
            <Select
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="w-full"
            >
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
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {files.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                        No files found
                      </td>
                    </tr>
                  ) : (
                    files.map((file) => (
                      <tr key={file.path} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center">
                            <span className="mr-2">{getFileIcon(file.language)}</span>
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
  );
};

export default IndexedFiles;
