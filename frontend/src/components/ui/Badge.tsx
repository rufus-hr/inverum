import React from 'react';
import { cn } from '../../lib/utils';
import { getStatusBadgeClass, type StatusVariant } from '../../lib/statusStyles';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  children: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ variant = 'neutral', children, className, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider',
          getStatusBadgeClass(variant),
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

export default Badge;
