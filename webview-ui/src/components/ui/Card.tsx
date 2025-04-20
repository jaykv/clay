import React from 'react';
import { cn } from '@/utils/cn';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

const Card = ({ title, children, actions, className = '' }: CardProps) => {
  return (
    <div className={cn('bg-vscode-bg border border-vscode-panel-border overflow-hidden rounded-lg', className)}>
      {title && (
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-vscode-fg">{title}</h3>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="px-4 py-5 sm:p-6">{children}</div>
    </div>
  );
};

export default Card;
