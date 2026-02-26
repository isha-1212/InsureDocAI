import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, trendUp, className }: StatCardProps) {
  return (
    <div className={cn("bg-card p-4 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
          <h3 className="text-xl font-bold font-display">{value}</h3>
        </div>
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className={cn(
            "font-medium px-1.5 py-0.5 rounded",
            trendUp ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
          )}>
            {trend}
          </span>
          <span className="text-muted-foreground">vs last month</span>
        </div>
      )}
    </div>
  );
}
