import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { searchCodebase } from '@/lib/api/augment';
import { postMessage } from '@/utils/vscode';
import { useDebounce } from '@/hooks/useDebounce';

// Types for search results
interface CodeSnippet {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
}

interface CodeSymbol {
  name: string;
  type: string;
  filePath: string;
  startLine: number;
  endLine: number;
  parent?: string;
  signature?: string;
}

interface SearchResult {
  snippets: CodeSnippet[];
  symbols?: CodeSymbol[];
  relevanceScore: number;
}

const CodeSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'snippets' | 'symbols'>('snippets');
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Debounce search query to avoid too many API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedSearchQuery || debouncedSearchQuery.length < 2) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await searchCodebase(debouncedSearchQuery, 20, 'json');
        console.log('Search results:', data); // Add logging to see the response

        // Handle different response formats
        if (data && data.results) {
          // If the response has a 'results' property, use that
          setResults(data.results);
        } else if (Array.isArray(data)) {
          // If the response is already an array, use it directly
          setResults(data);
        } else {
          // If the response is in an unexpected format, log it and set empty results
          console.error('Unexpected search results format:', data);
          setResults([]);
        }
      } catch (err) {
        console.error('Error searching codebase:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Force immediate search
    if (searchQuery.length >= 2) {
      const performSearch = async () => {
        setLoading(true);
        setError(null);

        try {
          const data = await searchCodebase(searchQuery, 20, 'json');
          console.log('Search results (submit):', data); // Add logging to see the response

          // Handle different response formats
          if (data && data.results) {
            // If the response has a 'results' property, use that
            setResults(data.results);
          } else if (Array.isArray(data)) {
            // If the response is already an array, use it directly
            setResults(data);
          } else {
            // If the response is in an unexpected format, log it and set empty results
            console.error('Unexpected search results format:', data);
            setResults([]);
          }
        } catch (err) {
          console.error('Error searching codebase:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
          setLoading(false);
        }
      };

      performSearch();
    }
  };

  // Toggle expanded state for a result
  const toggleExpanded = (resultId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  // Navigate to file in VSCode
  const navigateToFile = (filePath: string, startLine: number, endLine: number) => {
    if (typeof window.acquireVsCodeApi === 'function') {
      postMessage({
        command: 'clay.openFile',
        filePath,
        startLine,
        endLine,
      });
    } else {
      alert(`Would navigate to ${filePath} at lines ${startLine}-${endLine} in VS Code`);
    }
  };

  // Get all symbols from all results
  const getAllSymbols = (): CodeSymbol[] => {
    return results
      .filter(result => result.symbols && result.symbols.length > 0)
      .flatMap(result => result.symbols || []);
  };

  // Render code snippet with syntax highlighting
  const renderCodeSnippet = (snippet: CodeSnippet) => {
    return (
      <div className="relative group">
        <pre className="text-xs overflow-x-auto p-2 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
          <code>{snippet.content}</code>
        </pre>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigateToFile(snippet.filePath, snippet.startLine, snippet.endLine)}
            leftIcon={<span className="material-icons text-xs">open_in_new</span>}
          >
            Open
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search codebase for functions, classes, or text..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full"
            leftIcon={<span className="material-icons text-sm">search</span>}
          />
        </div>
        <Button type="submit" disabled={loading || searchQuery.length < 2}>
          Search
        </Button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">
          <p className="font-medium">Error searching codebase</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center p-8">
          <Spinner size="lg" />
          <span className="ml-2">Searching codebase...</span>
        </div>
      )}

      {!loading && debouncedSearchQuery && results.length === 0 && (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          No results found for "{debouncedSearchQuery}"
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              className={`px-4 py-2 font-medium text-sm ${
                activeTab === 'snippets'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('snippets')}
            >
              Code Snippets ({results.reduce((acc, result) => acc + result.snippets.length, 0)})
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm ${
                activeTab === 'symbols'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('symbols')}
            >
              Symbols ({getAllSymbols().length})
            </button>
          </div>

          {activeTab === 'snippets' ? (
            <div className="space-y-4">
              {results.map((result, resultIndex) => (
                <div
                  key={`result-${resultIndex}`}
                  className="border rounded-md overflow-hidden bg-white dark:bg-gray-800"
                >
                  {result.snippets.map((snippet, snippetIndex) => (
                    <div
                      key={`snippet-${resultIndex}-${snippetIndex}`}
                      className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                    >
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => toggleExpanded(`${resultIndex}-${snippetIndex}`)}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="material-icons text-gray-500 dark:text-gray-400">
                            {expandedResults.has(`${resultIndex}-${snippetIndex}`)
                              ? 'expand_more'
                              : 'chevron_right'}
                          </span>
                          <span className="font-medium text-sm truncate max-w-md">
                            {snippet.filePath}
                          </span>
                          <Badge variant="outline">
                            Lines {snippet.startLine}-{snippet.endLine}
                          </Badge>
                          {snippet.language && <Badge>{snippet.language}</Badge>}
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            navigateToFile(snippet.filePath, snippet.startLine, snippet.endLine);
                          }}
                          leftIcon={<span className="material-icons text-xs">open_in_new</span>}
                        >
                          Open
                        </Button>
                      </div>
                      {expandedResults.has(`${resultIndex}-${snippetIndex}`) && (
                        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                          {renderCodeSnippet(snippet)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden bg-white dark:bg-gray-800">
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
                      File
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {getAllSymbols().map((symbol, index) => (
                    <tr key={`symbol-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div className="font-medium">{symbol.name}</div>
                        {symbol.signature && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {symbol.signature}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        <Badge variant="outline">{symbol.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        <div className="truncate max-w-xs">{symbol.filePath}</div>
                        <div className="text-xs">Line {symbol.startLine}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            navigateToFile(symbol.filePath, symbol.startLine, symbol.endLine)
                          }
                          leftIcon={<span className="material-icons text-xs">open_in_new</span>}
                        >
                          Go to Definition
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeSearch;
