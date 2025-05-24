import React from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
  variant = 'default',
}) => {
  const variantClasses = {
    default: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        );
      case 'down':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
          </svg>
        );
      case 'neutral':
        return (
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        );
    }
  };

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all duration-200 hover:shadow-md',
        variantClasses[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            {icon && <div className="text-gray-500 dark:text-gray-400">{icon}</div>}
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {trend && (
          <div className="flex items-center space-x-1 text-sm">
            {getTrendIcon(trend.direction)}
            <span
              className={cn(
                'font-medium',
                trend.direction === 'up' && 'text-green-600 dark:text-green-400',
                trend.direction === 'down' && 'text-red-600 dark:text-red-400',
                trend.direction === 'neutral' && 'text-gray-600 dark:text-gray-400'
              )}
            >
              {trend.value}%
            </span>
            <span className="text-gray-500 dark:text-gray-500">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
