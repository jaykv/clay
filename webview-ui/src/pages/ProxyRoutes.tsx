import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getProxyRoutes, addProxyRoute, deleteProxyRoute, ProxyRoute } from '@/lib/api/proxyRoutes';

const ProxyRoutes: React.FC = () => {
  const [routes, setRoutes] = useState<ProxyRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Proxy Routes Manager</h1>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? 'Cancel' : 'Add Route'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <Card title="Add New Route">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="path"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Path
              </label>
              <input
                type="text"
                id="path"
                value={path}
                onChange={e => setPath(e.target.value)}
                placeholder="e.g., hello or api/v1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              {formErrors.path && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.path}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This will be accessible at http://localhost:3000/proxy/{path}
              </p>
            </div>

            <div>
              <label
                htmlFor="target"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Target URL
              </label>
              <input
                type="text"
                id="target"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="e.g., https://api.example.com"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              {formErrors.target && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.target}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                The URL to forward requests to
              </p>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Description (optional)
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g., Production API"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" isLoading={loading}>
                Add Route
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Configured Routes">
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Routes are used to proxy requests from{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
            http://localhost:3000/proxy/{'{path}'}
          </code>{' '}
          to the target URL.
        </p>

        {loading ? (
          <div className="py-4 text-center text-gray-500 dark:text-gray-400">
            <svg
              className="animate-spin h-5 w-5 mx-auto mb-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Loading routes...
          </div>
        ) : routes.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            No routes configured yet.
          </div>
        ) : (
          <div className="space-y-3">
            {routes.map(route => (
              <div
                key={route.path}
                className="flex items-center justify-between p-3 border rounded-md bg-white dark:bg-gray-800"
              >
                <div>
                  <div className="flex items-center">
                    <span className="font-medium">{route.path}</span>
                    {route.description && (
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        ({route.description})
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    → {route.target}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => handleDelete(route.path)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProxyRoutes;
