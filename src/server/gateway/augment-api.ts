import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { augmentEngine } from '../augment';

/**
 * Register the Augment Context Engine API with Fastify
 */
export function registerAugmentAPI(fastify: FastifyInstance, options: any, done: () => void) {
  // Get index status
  fastify.get('/api/augment/status', async (request, reply) => {
    try {
      // Ensure the engine is initialized
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      }

      const status = augmentEngine.getIndexStatus();
      return { status };
    } catch (error) {
      logger.error('Failed to get index status:', error);
      return reply.status(500).send({ error: 'Failed to get index status' });
    }
  });

  // Get all indexed files
  fastify.get('/api/augment/files', async (request, reply) => {
    try {
      // Ensure the engine is initialized
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      }

      // Parse pagination and filter parameters
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const filter = url.searchParams.get('filter') || '';
      const language = url.searchParams.get('language') || '';

      // Get all files from the indexer
      const allFiles = augmentEngine.getAllFiles();

      // Filter files if needed
      let filteredFiles = allFiles;

      if (filter) {
        const lowerFilter = filter.toLowerCase();
        filteredFiles = filteredFiles.filter(file => file.path.toLowerCase().includes(lowerFilter));
      }

      if (language) {
        filteredFiles = filteredFiles.filter(file => file.language === language);
      }

      // Sort files by path
      filteredFiles.sort((a, b) => a.path.localeCompare(b.path));

      // Paginate results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

      // Return only necessary information to reduce payload size
      const files = paginatedFiles.map(file => ({
        path: file.path,
        language: file.language,
        size: file.size,
        lastModified: file.lastModified,
      }));

      return {
        files,
        pagination: {
          total: filteredFiles.length,
          page,
          limit,
          totalPages: Math.ceil(filteredFiles.length / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get indexed files:', error);
      return reply.status(500).send({ error: 'Failed to get indexed files' });
    }
  });

  // Get file details
  fastify.get<{
    Params: { path: string };
  }>('/api/augment/files/:path', async (request, reply) => {
    try {
      // Ensure the engine is initialized
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      }

      const filePath = request.params.path;

      // URL decode the path parameter
      const decodedPath = decodeURIComponent(filePath);

      const file = augmentEngine.getFile(decodedPath);

      if (!file) {
        return reply.status(404).send({ error: 'File not found' });
      }

      // Get symbols in the file
      const symbols = await augmentEngine.getSymbolsInFile(decodedPath);

      return {
        file,
        symbols,
      };
    } catch (error) {
      logger.error('Failed to get file details:', error);
      return reply.status(500).send({ error: 'Failed to get file details' });
    }
  });

  // Search indexed files
  fastify.get('/api/augment/search', async (request, reply) => {
    try {
      // Ensure the engine is initialized
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      }

      // Parse search parameters
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const query = url.searchParams.get('q') || '';
      const maxResults = parseInt(url.searchParams.get('limit') || '10', 10);
      const format = url.searchParams.get('format') || 'json';

      if (!query) {
        return reply.status(400).send({ error: 'Missing search query' });
      }

      const results = await augmentEngine.searchCode(query, maxResults);

      // If format is html, return a simple HTML page with the results
      if (format === 'html') {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Search Results for "${query}"</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; padding: 20px; max-width: 1200px; margin: 0 auto; color: #333; }
            h1 { color: #2563eb; }
            .result { margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; }
            .file-path { font-weight: bold; color: #1e40af; margin-bottom: 10px; }
            .snippet { background-color: #f9fafb; padding: 10px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; margin-bottom: 10px; }
            .highlight { background-color: #fef3c7; font-weight: bold; }
            .symbol { background-color: #e0f2fe; padding: 2px 6px; border-radius: 4px; margin-right: 5px; display: inline-block; margin-bottom: 5px; }
            .back-link { display: block; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Search Results for "${query}"</h1>
          <p>Found ${results.length} results</p>

          <div class="results">
            ${results
              .map(
                (result, index) => `
              <div class="result">
                <div class="file-path">${result.snippets[0]?.filePath || 'Unknown file'}</div>
                ${result.snippets
                  .map(
                    snippet => `
                  <div class="snippet">
                    <div>${snippet.content.replace(new RegExp(query, 'gi'), match => `<span class="highlight">${match}</span>`)}</div>
                    <div>Line: ${snippet.startLine}-${snippet.endLine}</div>
                  </div>
                `
                  )
                  .join('')}

                ${
                  result.symbols && result.symbols.length > 0
                    ? `
                  <div class="symbols">
                    <strong>Symbols:</strong>
                    ${result.symbols
                      .map(
                        symbol => `
                      <span class="symbol">${symbol.name} (${symbol.type})</span>
                    `
                      )
                      .join('')}
                  </div>
                `
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>

          <a href="/" class="back-link">Back to Dashboard</a>
        </body>
        </html>
        `;

        reply.type('text/html').send(html);
        return;
      }

      // Default: return JSON
      return { results };
    } catch (error) {
      logger.error('Failed to search indexed files:', error);
      return reply.status(500).send({ error: 'Failed to search indexed files' });
    }
  });

  // Reindex codebase
  fastify.post('/api/augment/reindex', async (request, reply) => {
    try {
      // Ensure the engine is initialized
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      }

      // Start reindexing in the background
      augmentEngine.reindex().catch(error => {
        logger.error('Error during reindexing:', error);
      });

      return { success: true, message: 'Reindexing started' };
    } catch (error) {
      logger.error('Failed to start reindexing:', error);
      return reply.status(500).send({ error: 'Failed to start reindexing' });
    }
  });

  // Get available languages
  fastify.get('/api/augment/languages', async (request, reply) => {
    try {
      // Ensure the engine is initialized
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      }

      // Get all files
      const allFiles = augmentEngine.getAllFiles();

      // Extract unique languages
      const languages = [...new Set(allFiles.map(file => file.language))].filter(Boolean);

      // Sort languages alphabetically
      languages.sort();

      return { languages };
    } catch (error) {
      logger.error('Failed to get languages:', error);
      return reply.status(500).send({ error: 'Failed to get languages' });
    }
  });

  done();
}
