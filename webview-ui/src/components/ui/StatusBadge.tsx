import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status?: number | string;
  variant?: 'default' | 'outline' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const getStatusInfo = (status?: number | string) => {
    if (!status) return { label: 'Pending', color: 'gray' };
    
    const statusCode = typeof status === 'string' ? parseInt(status) : status;
    
    if (statusCode >= 200 && statusCode < 300) {
      return { label: statusCode.toString(), color: 'green' };
    } else if (statusCode >= 300 && statusCode < 400) {
      return { label: statusCode.toString(), color: 'blue' };
    } else if (statusCode >= 400 && statusCode < 500) {
      return { label: statusCode.toString(), color: 'yellow' };
    } else if (statusCode >= 500) {
      return { label: statusCode.toString(), color: 'red' };
    }
    
    return { label: status.toString(), color: 'gray' };
  };

  const { label, color } = getStatusInfo(status);

  const baseClasses = 'inline-flex items-center font-medium rounded-full transition-colors';
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const colorClasses = {
    default: {
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    },
    outline: {
      green: 'border border-green-300 text-green-700 dark:border-green-600 dark:text-green-300',
      blue: 'border border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300',
      yellow: 'border border-yellow-300 text-yellow-700 dark:border-yellow-600 dark:text-yellow-300',
      red: 'border border-red-300 text-red-700 dark:border-red-600 dark:text-red-300',
      gray: 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300',
    },
    subtle: {
      green: 'text-green-700 dark:text-green-300',
      blue: 'text-blue-700 dark:text-blue-300',
      yellow: 'text-yellow-700 dark:text-yellow-300',
      red: 'text-red-700 dark:text-red-300',
      gray: 'text-gray-700 dark:text-gray-300',
    },
  };

  return (
    <span
      className={cn(
        baseClasses,
        sizeClasses[size],
        colorClasses[variant][color as keyof typeof colorClasses[typeof variant]],
        className
      )}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
