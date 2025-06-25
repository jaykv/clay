/**
 * File Tree Selector - Tree view for selecting files/folders to index (Augment-style)
 */

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, File, Check, Minus } from 'lucide-react';
import * as personalIndexAPI from '@/lib/api/personal-index';

// Use the type from the API
type FileTreeNode = personalIndexAPI.FileTreeNode;

interface FileTreeSelectorProps {
  workspacePath: string;
  onSelectionChange: (selectedPaths: string[]) => void;
  className?: string;
}

interface TreeNodeProps {
  node: FileTreeNode;
  level: number;
  onToggle: (path: string) => void;
  onSelect: (path: string, selected: boolean) => void;
  isExpanded: boolean;
  selectionState: 'none' | 'partial' | 'all';
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  onToggle,
  onSelect,
  isExpanded,
  selectionState,
}) => {
  const handleToggle = () => {
    if (node.type === 'directory') {
      onToggle(node.path);
    }
  };

  const handleSelect = () => {
    const newSelected = selectionState !== 'all';
    onSelect(node.path, newSelected);
  };

  const getCheckboxIcon = () => {
    switch (selectionState) {
      case 'all':
        return <Check className="w-4 h-4 text-blue-600" />;
      case 'partial':
        return <Minus className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Expand/Collapse Icon */}
        {node.type === 'directory' && (
          <button
            onClick={handleToggle}
            className="mr-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Checkbox */}
        <button
          onClick={handleSelect}
          className={`mr-2 w-4 h-4 border border-gray-300 dark:border-gray-600 rounded flex items-center justify-center
            ${selectionState !== 'none' ? 'bg-blue-50 dark:bg-blue-900 border-blue-600' : 'bg-white dark:bg-gray-800'}
            hover:border-blue-500`}
        >
          {getCheckboxIcon()}
        </button>

        {/* File/Folder Icon */}
        {node.type === 'directory' ? (
          <Folder className="w-4 h-4 mr-2 text-blue-500" />
        ) : (
          <File className="w-4 h-4 mr-2 text-gray-500" />
        )}

        {/* Name and Size */}
        <div className="flex-1 flex items-center justify-between">
          <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
            {node.name}
          </span>
          {node.type === 'file' && node.size && (
            <span className="text-xs text-gray-500 ml-2">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeContainer
              key={child.path}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TreeNodeContainer: React.FC<{
  node: FileTreeNode;
  level: number;
  onToggle: (path: string) => void;
  onSelect: (path: string, selected: boolean) => void;
}> = ({ node, level, onToggle, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectionState, setSelectionState] = useState<'none' | 'partial' | 'all'>('none');

  const handleToggle = (path: string) => {
    if (path === node.path) {
      setIsExpanded(!isExpanded);
    }
    onToggle(path);
  };

  // Calculate selection state based on children
  useEffect(() => {
    if (node.type === 'file') {
      setSelectionState(node.selected ? 'all' : 'none');
    } else if (node.children) {
      const selectedChildren = node.children.filter(child => child.selected);
      if (selectedChildren.length === 0) {
        setSelectionState('none');
      } else if (selectedChildren.length === node.children.length) {
        setSelectionState('all');
      } else {
        setSelectionState('partial');
      }
    }
  }, [node]);

  return (
    <TreeNode
      node={node}
      level={level}
      onToggle={handleToggle}
      onSelect={onSelect}
      isExpanded={isExpanded}
      selectionState={selectionState}
    />
  );
};

const FileTreeSelector: React.FC<FileTreeSelectorProps> = ({
  workspacePath,
  onSelectionChange,
  className = '',
}) => {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Load workspace tree
  useEffect(() => {
    loadWorkspaceTree();
  }, [workspacePath]);

  const loadWorkspaceTree = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await personalIndexAPI.getWorkspaceTree(workspacePath);
      setTree(data.tree);
    } catch (err) {
      console.error('Error loading workspace tree:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (_path: string) => {
    // Handled by individual TreeNode components
  };

  const handleSelect = (path: string, selected: boolean) => {
    const newSelectedPaths = new Set(selectedPaths);
    
    if (selected) {
      newSelectedPaths.add(path);
      // Also select all children if it's a directory
      selectAllChildren(tree, path, newSelectedPaths, true);
    } else {
      newSelectedPaths.delete(path);
      // Also deselect all children if it's a directory
      selectAllChildren(tree, path, newSelectedPaths, false);
    }

    setSelectedPaths(newSelectedPaths);
    onSelectionChange(Array.from(newSelectedPaths));
    
    // Update tree with new selection state
    updateTreeSelection(tree, newSelectedPaths);
  };

  const selectAllChildren = (
    nodes: FileTreeNode[],
    targetPath: string,
    selectedPaths: Set<string>,
    select: boolean
  ) => {
    for (const node of nodes) {
      if (node.path === targetPath && node.children) {
        const updateChildren = (children: FileTreeNode[]) => {
          for (const child of children) {
            if (select) {
              selectedPaths.add(child.path);
            } else {
              selectedPaths.delete(child.path);
            }
            if (child.children) {
              updateChildren(child.children);
            }
          }
        };
        updateChildren(node.children);
        break;
      } else if (node.children) {
        selectAllChildren(node.children, targetPath, selectedPaths, select);
      }
    }
  };

  const updateTreeSelection = (nodes: FileTreeNode[], selectedPaths: Set<string>) => {
    for (const node of nodes) {
      node.selected = selectedPaths.has(node.path);
      if (node.children) {
        updateTreeSelection(node.children, selectedPaths);
      }
    }
    setTree([...tree]); // Trigger re-render
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Loading workspace...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-red-600 dark:text-red-400 text-sm">
          Error: {error}
        </div>
        <button
          onClick={loadWorkspaceTree}
          className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-96 overflow-auto">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No files found in workspace
          </div>
        ) : (
          <div className="py-2">
            {tree.map((node) => (
              <TreeNodeContainer
                key={node.path}
                node={node}
                level={0}
                onToggle={handleToggle}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {selectedPaths.size > 0 && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {selectedPaths.size} item{selectedPaths.size !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
};

export default FileTreeSelector;
