import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sublabel?: string;
  accent?: "green" | "blue" | "amber" | "red";
  children?: ReactNode;
}

const accentMap = {
  green: "bg-accent-green/10 text-accent-green ring-accent-green/20",
  blue: "bg-accent-blue/10 text-accent-blue ring-accent-blue/20",
  amber: "bg-warn/10 text-warn ring-warn/20",
  red: "bg-danger/10 text-danger ring-danger/20",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent = "green",
  children,
}: StatCardProps) {
  return (
    <div className="group rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft hover:border-base-600 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white tabular-nums">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-gray-500">{sublabel}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ring-1 ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
