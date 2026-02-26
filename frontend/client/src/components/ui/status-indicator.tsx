import { cn } from '@/lib/utils';
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

interface StatusIndicatorProps {
    status: 'Approved' | 'Rejected' | 'Pending' | 'Under Review';
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

export function StatusIndicator({ status, size = 'md', showIcon = true }: StatusIndicatorProps) {
    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'Approved':
                return {
                    icon: <CheckCircle className="w-4 h-4" />,
                    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                };
            case 'Rejected':
                return {
                    icon: <XCircle className="w-4 h-4" />,
                    className: 'bg-red-100 text-red-700 border-red-200',
                };
            case 'Under Review':
                return {
                    icon: <AlertCircle className="w-4 h-4" />,
                    className: 'bg-blue-100 text-blue-700 border-blue-200',
                };
            default: // Pending
                return {
                    icon: <Clock className="w-4 h-4" />,
                    className: 'bg-amber-100 text-amber-700 border-amber-200',
                };
        }
    };

    const getSizeClass = (size: string) => {
        switch (size) {
            case 'sm': return 'text-xs px-2 py-1';
            case 'lg': return 'text-sm px-4 py-2';
            default: return 'text-sm px-3 py-1.5';
        }
    };

    const config = getStatusConfig(status);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 font-medium rounded-full border',
                config.className,
                getSizeClass(size)
            )}
        >
            {showIcon && config.icon}
            {status}
        </span>
    );
}