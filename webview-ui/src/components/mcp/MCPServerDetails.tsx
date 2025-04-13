import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion';

interface MCPResourceInfo {
  id: string;
  template: string;
}

interface MCPToolInfo {
  id: string;
  parameters: Record<string, any>;
  description?: string;
}

interface MCPPromptInfo {
  id: string;
  parameters: Record<string, any>;
}

interface MCPServerInfo {
  name: string;
  version: string;
  resources: MCPResourceInfo[];
  tools: MCPToolInfo[];
  prompts: MCPPromptInfo[];
}

const MCPServerDetails: React.FC = () => {
  const [serverInfo, setServerInfo] = useState<MCPServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMCPServerInfo();
  }, []);

  const fetchMCPServerInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/info');

      if (!response.ok) {
        throw new Error(`Failed to fetch MCP server info: ${response.statusText}`);
      }

      const data = await response.json();
      setServerInfo(data);
    } catch (err) {
      console.error('Error fetching MCP server info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const renderParameters = (params: Record<string, any>) => {
    return (
      <div className="mt-2 space-y-1">
        {Object.entries(params).map(([name, type]) => (
          <div key={name} className="flex items-start">
            <span className="font-mono text-sm text-blue-600 dark:text-blue-400 mr-2">{name}:</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {typeof type === 'object' ? JSON.stringify(type) : type.toString()}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card title="MCP Server">
      {loading && !serverInfo ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p>Loading MCP server information...</p>
        </div>
      ) : error && !serverInfo ? (
        <div className="py-8 text-center text-red-500">
          <p>{error}</p>
          <button
            onClick={fetchMCPServerInfo}
            className="mt-4 px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Try Again
          </button>
        </div>
      ) : serverInfo ? (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div>
              <h3 className="text-lg font-medium">{serverInfo.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Version: {serverInfo.version}
              </p>
            </div>
            <button
              onClick={fetchMCPServerInfo}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center"
            >
              {loading ? <Spinner size="sm" className="mr-2" /> : null}
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <Tabs defaultValue="tools" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="tools">Tools ({serverInfo.tools.length})</TabsTrigger>
              <TabsTrigger value="prompts">Prompts ({serverInfo.prompts.length})</TabsTrigger>
              <TabsTrigger value="resources">Resources ({serverInfo.resources.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tools" className="space-y-4">
              {serverInfo.tools.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No tools available
                </p>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {serverInfo.tools.map(tool => (
                    <AccordionItem key={tool.id} value={tool.id}>
                      <AccordionTrigger className="text-left">
                        <div className="flex flex-col">
                          <span className="font-medium">{tool.id}</span>
                          {tool.description && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {tool.description}
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <h4 className="text-sm font-medium mb-1">Parameters:</h4>
                          {renderParameters(tool.parameters)}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>

            <TabsContent value="prompts" className="space-y-4">
              {serverInfo.prompts.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No prompts available
                </p>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {serverInfo.prompts.map(prompt => (
                    <AccordionItem key={prompt.id} value={prompt.id}>
                      <AccordionTrigger className="text-left">
                        <span className="font-medium">{prompt.id}</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <h4 className="text-sm font-medium mb-1">Parameters:</h4>
                          {renderParameters(prompt.parameters)}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>

            <TabsContent value="resources" className="space-y-4">
              {serverInfo.resources.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No resources available
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          ID
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          Template
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                      {serverInfo.resources.map(resource => (
                        <tr key={resource.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {resource.id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {resource.template}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </Card>
  );
};

export default MCPServerDetails;
