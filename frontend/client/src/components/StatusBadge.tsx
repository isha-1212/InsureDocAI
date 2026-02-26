import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Handle undefined or null status
  if (!status) {
    return (
      <span className={cn(
        "px-2.5 py-1 rounded-full text-xs font-semibold border",
        "bg-slate-100 text-slate-700 border-slate-200",
        className
      )}>
        Unknown
      </span>
    );
  }

  const styles = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20",
    active: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  };

  const statusKey = status.toLowerCase() as keyof typeof styles;
  const style = styles[statusKey] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span className={cn(
      "px-2.5 py-1 rounded-full text-xs font-semibold border capitalize",
      style,
      className
    )}>
      {status}
    </span>
  );
}
