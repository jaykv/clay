/**
 * API Routes for Personal Index System (Augment-style)
 * Provides REST endpoints for managing personal code indexing
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../utils/logger';
import { PersonalIndexManager } from './index';
import { FileSelection } from './models';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

/**
 * Personal Index Manager instance (singleton)
 */
let personalIndexManager: PersonalIndexManager | null = null;

/**
 * Get or create personal index manager
 */
function getPersonalIndexManager(workspacePath: string): PersonalIndexManager {
  if (!personalIndexManager) {
    personalIndexManager = new PersonalIndexManager(workspacePath);
  }
  return personalIndexManager;
}

/**
 * Register personal index API routes
 */
export function registerPersonalIndexAPI(fastify: FastifyInstance, options: any, done: () => void) {
  
  // Initialize personal index system
  fastify.post('/api/augment/personal-index/initialize', async (request, reply) => {
    try {
      const { workspacePath } = request.body as { workspacePath: string };
      
      if (!workspacePath || !fs.existsSync(workspacePath)) {
        return reply.status(400).send({ error: 'Invalid workspace path' });
      }

      const manager = getPersonalIndexManager(workspacePath);
      await manager.initialize();

      return { success: true, message: 'Personal index system initialized' };
    } catch (error) {
      logger.error('Failed to initialize personal index:', error);
      return reply.status(500).send({ error: 'Failed to initialize personal index system' });
    }
  });

  // Get workspace file tree
  fastify.get('/api/augment/personal-index/workspace-tree', async (request, reply) => {
    try {
      const { workspacePath } = request.query as { workspacePath: string };
      
      if (!workspacePath || !fs.existsSync(workspacePath)) {
        return reply.status(400).send({ error: 'Invalid workspace path' });
      }

      const tree = await buildFileTree(workspacePath);
      return { tree };
    } catch (error) {
      logger.error('Failed to get workspace tree:', error);
      return reply.status(500).send({ error: 'Failed to get workspace tree' });
    }
  });

  // Start indexing with file selection
  fastify.post('/api/augment/personal-index/start', async (request, reply) => {
    try {
      const { workspacePath, fileSelection } = request.body as { 
        workspacePath: string; 
        fileSelection: FileSelection 
      };

      if (!personalIndexManager) {
        return reply.status(400).send({ error: 'Personal index not initialized' });
      }

      await personalIndexManager.startIndexing(fileSelection);
      return { success: true, message: 'Indexing started' };
    } catch (error) {
      logger.error('Failed to start indexing:', error);
      return reply.status(500).send({ error: 'Failed to start indexing' });
    }
  });

  // Get indexing progress
  fastify.get('/api/augment/personal-index/progress', async (request, reply) => {
    try {
      if (!personalIndexManager) {
        return reply.status(400).send({ error: 'Personal index not initialized' });
      }

      const progress = personalIndexManager.getIndexStatus();
      return { progress };
    } catch (error) {
      logger.error('Failed to get indexing progress:', error);
      return reply.status(500).send({ error: 'Failed to get indexing progress' });
    }
  });

  // Stop indexing
  fastify.post('/api/augment/personal-index/stop', async (request, reply) => {
    try {
      if (!personalIndexManager) {
        return reply.status(400).send({ error: 'Personal index not initialized' });
      }

      personalIndexManager.stopIndexing();
      return { success: true, message: 'Indexing stopped' };
    } catch (error) {
      logger.error('Failed to stop indexing:', error);
      return reply.status(500).send({ error: 'Failed to stop indexing' });
    }
  });

  // Semantic search
  fastify.get('/api/augment/personal-index/search', async (request, reply) => {
    try {
      const { query, maxResults = 10 } = request.query as { 
        query: string; 
        maxResults?: number 
      };

      if (!query) {
        return reply.status(400).send({ error: 'Query parameter is required' });
      }

      if (!personalIndexManager) {
        return reply.status(400).send({ error: 'Personal index not initialized' });
      }

      const results = await personalIndexManager.search(query, maxResults);
      return { results };
    } catch (error) {
      logger.error('Failed to perform semantic search:', error);
      return reply.status(500).send({ error: 'Failed to perform semantic search' });
    }
  });

  // Get index status
  fastify.get('/api/augment/personal-index/status', async (request, reply) => {
    try {
      if (!personalIndexManager) {
        return { 
          initialized: false, 
          index: null, 
          progress: null 
        };
      }

      const index = personalIndexManager.getCurrentIndex();
      const progress = personalIndexManager.getIndexStatus();

      return {
        initialized: true,
        index: index ? {
          id: index.id,
          branch: index.branch,
          commit: index.commit,
          metadata: index.metadata,
        } : null,
        progress,
      };
    } catch (error) {
      logger.error('Failed to get index status:', error);
      return reply.status(500).send({ error: 'Failed to get index status' });
    }
  });

  // Get ignore patterns
  fastify.get('/api/augment/personal-index/ignore-patterns', async (request, reply) => {
    try {
      const { workspacePath } = request.query as { workspacePath: string };
      
      const patterns = await getIgnorePatterns(workspacePath);
      return { patterns };
    } catch (error) {
      logger.error('Failed to get ignore patterns:', error);
      return reply.status(500).send({ error: 'Failed to get ignore patterns' });
    }
  });

  // Update ignore patterns
  fastify.post('/api/augment/personal-index/ignore-patterns', async (request, reply) => {
    try {
      const { workspacePath, patterns } = request.body as { 
        workspacePath: string; 
        patterns: string[] 
      };

      await saveIgnorePatterns(workspacePath, patterns);
      return { success: true, message: 'Ignore patterns updated' };
    } catch (error) {
      logger.error('Failed to update ignore patterns:', error);
      return reply.status(500).send({ error: 'Failed to update ignore patterns' });
    }
  });

  done();
}

/**
 * Helper functions
 */

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
  selected?: boolean;
}

async function buildFileTree(workspacePath: string, relativePath = ''): Promise<FileTreeNode[]> {
  const fullPath = path.join(workspacePath, relativePath);
  const items = fs.readdirSync(fullPath);
  const tree: FileTreeNode[] = [];

  for (const item of items) {
    const itemPath = path.join(fullPath, item);
    const itemRelativePath = path.join(relativePath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      // Skip common ignore directories for performance
      if (['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
        continue;
      }

      const children = await buildFileTree(workspacePath, itemRelativePath);
      tree.push({
        name: item,
        path: itemRelativePath,
        type: 'directory',
        children,
        selected: false,
      });
    } else {
      tree.push({
        name: item,
        path: itemRelativePath,
        type: 'file',
        size: stats.size,
        selected: false,
      });
    }
  }

  return tree.sort((a, b) => {
    // Directories first, then files
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

async function getIgnorePatterns(workspacePath: string): Promise<string[]> {
  const clayIgnorePath = path.join(workspacePath, '.clay', 'ignore');
  const gitIgnorePath = path.join(workspacePath, '.gitignore');
  
  const patterns: string[] = [];

  // Add default patterns
  patterns.push(
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '.next/**',
    '.vscode/**',
    '*.log',
    '.env*',
    'coverage/**',
    '.nyc_output/**'
  );

  // Read .clay/ignore if exists
  if (fs.existsSync(clayIgnorePath)) {
    const clayIgnore = fs.readFileSync(clayIgnorePath, 'utf-8');
    patterns.push(...clayIgnore.split('\n').filter(line => line.trim()));
  }

  // Read .gitignore if exists
  if (fs.existsSync(gitIgnorePath)) {
    const gitIgnore = fs.readFileSync(gitIgnorePath, 'utf-8');
    patterns.push(...gitIgnore.split('\n').filter(line => line.trim() && !line.startsWith('#')));
  }

  return [...new Set(patterns)]; // Remove duplicates
}

async function saveIgnorePatterns(workspacePath: string, patterns: string[]): Promise<void> {
  const clayDir = path.join(workspacePath, '.clay');
  const clayIgnorePath = path.join(clayDir, 'ignore');

  // Ensure .clay directory exists
  if (!fs.existsSync(clayDir)) {
    fs.mkdirSync(clayDir, { recursive: true });
  }

  // Save patterns
  fs.writeFileSync(clayIgnorePath, patterns.join('\n'));
}
