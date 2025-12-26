import React from 'react';
import { RequestStatus } from '../../types';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    size = 'sm',
}) => {
    const variantStyles = {
        default: 'bg-white/10 text-white/80 border-white/20',
        success: 'bg-green-500/20 text-green-300 border-green-500/30',
        warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        danger: 'bg-red-500/20 text-red-300 border-red-500/30',
        info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    };

    const sizeStyles = {
        sm: 'px-2.5 py-1 text-xs',
        md: 'px-3 py-1.5 text-sm',
    };

    return (
        <span
            className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
        >
            {children}
        </span>
    );
};

interface StatusBadgeProps {
    status: RequestStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const statusConfig = {
        open: { label: 'Open', variant: 'danger' as const },
        in_progress: { label: 'In Progress', variant: 'warning' as const },
        closed: { label: 'Closed', variant: 'success' as const },
    };

    const config = statusConfig[status];

    return (
        <Badge variant={config.variant} size="sm">
            {config.label}
        </Badge>
    );
};

export default Badge;
