import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
    confidence: number;
    size?: 'sm' | 'md' | 'lg';
    showPercentage?: boolean;
}

export function ConfidenceBadge({
    confidence,
    size = 'md',
    showPercentage = true
}: ConfidenceBadgeProps) {
    const percentage = Math.round(confidence * 100);

    const getColorClass = (score: number) => {
        if (score >= 90) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (score >= 75) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (score >= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-red-100 text-red-700 border-red-200';
    };

    const getSizeClass = (size: string) => {
        switch (size) {
            case 'sm': return 'text-xs px-2 py-1 min-w-[40px]';
            case 'lg': return 'text-sm px-3 py-2 min-w-[60px]';
            default: return 'text-xs px-2.5 py-1.5 min-w-[50px]';
        }
    };

    return (
        <span
            className={cn(
                'inline-flex items-center justify-center font-bold rounded-full border',
                getColorClass(percentage),
                getSizeClass(size)
            )}
        >
            {showPercentage ? `${percentage}%` : percentage}
        </span>
    );
}