import React from 'react';
import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => {
  const variantClasses = {
    default: 'bg-vscode-badge-background text-vscode-badge-foreground',
    outline:
      'bg-transparent border border-vscode-panel-border text-vscode-fg',
    secondary: 'bg-vscode-list-hoverBackground text-vscode-input-foreground',
    success: 'bg-vscode-button-bg text-vscode-button-fg',
    warning: 'bg-vscode-editorWarning-foreground text-white',
    danger: 'bg-vscode-errorForeground text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
