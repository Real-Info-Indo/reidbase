import { useState } from "react";
import {
  PlusCircle, BarChart3, FileText, MapPin, ClipboardEdit,
  Search, ChevronLeft, ChevronRight, MessageSquare, User,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTier, tierLabels } from "@/contexts/TierContext";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "New Analysis", url: "/", icon: PlusCircle },
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Market Reports", url: "/market-reports", icon: FileText },
  { title: "Location Reports", url: "/location-reports", icon: MapPin },
  { title: "Appraisal Request", url: "/appraisal-request", icon: ClipboardEdit },
];

const recentAnalysis = [
  "Canggu villa market Q3",
  "Seminyak rental yield",
  "Ubud land price trends",
  "Berawa development ROI",
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { tier, userName } = useTier();

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo + collapse */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-bold tracking-wide">
            <span className="text-sidebar-primary">REID</span> BASE
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-primary"
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}

        {/* Recent Analysis */}
        {!collapsed && (
          <div className="mt-8 px-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted mb-3">
              <Search className="h-3.5 w-3.5" />
              Recent Analysis
            </div>
            <div className="space-y-1">
              {recentAnalysis.map((item) => (
                <button
                  key={item}
                  className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground py-1.5 px-2 rounded-md hover:bg-sidebar-accent transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
            <User className="h-4 w-4 text-sidebar-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider bg-sidebar-primary/20 text-sidebar-primary px-2 py-0.5 rounded-full">
                {tierLabels[tier]}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
