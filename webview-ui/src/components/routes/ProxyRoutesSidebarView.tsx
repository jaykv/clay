import React, { useState, useEffect } from 'react';
import { Spinner } from '@/components/ui/Spinner';

import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getProxyRoutes, addProxyRoute, deleteProxyRoute, ProxyRoute } from '@/lib/api/proxyRoutes';

const ProxyRoutesSidebarView: React.FC = () => {
  // State for routes
  const [routes, setRoutes] = useState<ProxyRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [path, setPath] = useState('');
  const [target, setTarget] = useState('');
  const [description, setDescription] = useState('');
  const [formErrors, setFormErrors] = useState<{
    path?: string;
    target?: string;
  }>({});

  // Load routes on component mount
  useEffect(() => {
    loadRoutes();
  }, []);

  // Load routes from the API
  const loadRoutes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProxyRoutes();
      setRoutes(data);
    } catch (err) {
      setError('Failed to load proxy routes. Make sure the proxy server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Validate form
  const validateForm = () => {
    const errors: {
      path?: string;
      target?: string;
    } = {};

    if (!path.trim()) {
      errors.path = 'Path is required';
    } else if (path.includes('/')) {
      errors.path = 'Path should not include slashes';
    }

    if (!target.trim()) {
      errors.target = 'Target URL is required';
    } else {
      try {
        new URL(target);
      } catch (e) {
        errors.target = 'Target must be a valid URL';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await addProxyRoute({
        path: path.trim(),
        target: target.trim(),
        description: description.trim() || undefined,
      });

      // Reset form
      setPath('');
      setTarget('');
      setDescription('');
      setShowForm(false);

      // Reload routes
      await loadRoutes();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle route deletion
  const handleDelete = async (routePath: string) => {
    if (!confirm(`Are you sure you want to delete the route "${routePath}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await deleteProxyRoute(routePath);

      // Reload routes
      await loadRoutes();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter routes based on search query
  const getFilteredRoutes = () => {
    if (!searchQuery) {
      return routes;
    }

    const lowerQuery = searchQuery.toLowerCase();
    return routes.filter(
      route =>
        route.path.toLowerCase().includes(lowerQuery) ||
        route.target.toLowerCase().includes(lowerQuery) ||
        (route.description && route.description.toLowerCase().includes(lowerQuery))
    );
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Render the main component
  return (
    <div className="flex flex-col h-full overflow-auto p-2">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-medium">Proxy Routes</h2>
        <div className="flex space-x-2">
          <button
            onClick={loadRoutes}
            className="p-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center"
            title="Refresh Routes"
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </button>
          <Button
            size="sm"
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'Add'}
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-2 mb-3 text-xs">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-xs text-red-700 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Route Form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 mb-3">
          <h3 className="text-sm font-medium mb-2">Add New Route</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Path"
              id="path"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="e.g., hello or api/v1"
              error={formErrors.path}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Will be accessible at http://localhost:3000/proxy/{path}
            </p>

            <Input
              label="Target URL"
              id="target"
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="e.g., https://api.example.com"
              error={formErrors.target}
            />

            <Input
              label="Description (optional)"
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Production API"
            />

            <div className="flex justify-end">
              <Button type="submit" size="sm" isLoading={loading}>
                Add Route
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-3">
        <Input
          type="text"
          placeholder="Search routes..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full text-sm"
          leftIcon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
          rightIcon={
            searchQuery ? (
              <button onClick={clearSearch} className="text-gray-400 hover:text-gray-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Routes List */}
      <div className="flex-1 overflow-auto">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Routes proxy requests from{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
            localhost:3000/proxy/path
          </code>{' '}
          to target URL.
        </div>

        {loading && routes.length === 0 ? (
          <div className="py-4 text-center text-gray-500 dark:text-gray-400">
            <Spinner size="md" className="mx-auto mb-2" />
            <p className="text-sm">Loading routes...</p>
          </div>
        ) : getFilteredRoutes().length === 0 ? (
          <div className="py-4 text-center text-gray-500 dark:text-gray-400">
            {searchQuery
              ? `No routes found matching "${searchQuery}"`
              : 'No routes configured yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {getFilteredRoutes().map(route => (
              <div key={route.path} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm truncate">{route.path}</div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(route.path)}
                    className="h-6 px-2 py-0 text-xs"
                  >
                    Delete
                  </Button>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate mt-1">
                  → {route.target}
                </div>

                {route.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                    {route.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProxyRoutesSidebarView;
