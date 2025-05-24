import React from 'react';
import { cn } from '@/lib/utils';

interface EnhancedCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
}

const EnhancedCard: React.FC<EnhancedCardProps> = ({
  title,
  subtitle,
  children,
  className,
  headerActions,
  variant = 'default',
  size = 'md',
}) => {
  const baseClasses = 'rounded-lg border transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
    elevated: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl',
    outlined: 'bg-transparent border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
  };

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const headerSizeClasses = {
    sm: 'mb-2',
    md: 'mb-3',
    lg: 'mb-4',
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}>
      {(title || subtitle || headerActions) && (
        <div className={cn('flex items-start justify-between', headerSizeClasses[size])}>
          <div className="flex-1">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center space-x-2 ml-4">
              {headerActions}
            </div>
          )}
        </div>
      )}
      <div className="text-gray-700 dark:text-gray-300">
        {children}
      </div>
    </div>
  );
};

export default EnhancedCard;
