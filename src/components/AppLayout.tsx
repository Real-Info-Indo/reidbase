import { useState, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { PersistentDashboard, type PersistentDashboardHandle } from "./PersistentDashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSessionEnforcement } from "@/hooks/useSessionEnforcement";
import { useTier } from "@/contexts/TierContext";
import reidLogo from "@/assets/REID_Black.svg";

export function AppLayout() {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  const dashboardRef = useRef<PersistentDashboardHandle>(null);
  const { canAccess } = useTier();
  const canViewDashboard = canAccess("/dashboard");

  // Enforce single-device sessions for paid tiers
  useSessionEnforcement();

  return (
    <div className="flex h-screen w-full min-w-0 relative overflow-x-hidden overflow-y-hidden">
      {/* Mobile header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-sidebar/90 backdrop-blur-xl border-b border-sidebar-border">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md hover:bg-sidebar-accent transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <a href="https://realinfo.id" target="_blank" rel="noopener noreferrer"><img src={reidLogo} alt="REID Base" className="h-5" /></a>
        </header>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={
          isMobile
            ? `fixed top-14 left-0 bottom-0 z-40 transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`
            : "relative z-10"
        }
        style={isMobile ? { height: 'calc(100dvh - 3.5rem)' } : undefined}
      >
        <AppSidebar onNavigate={() => setMobileMenuOpen(false)} isMobile={isMobile} />
      </div>

      {/* Main content */}
      <main className={`flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-background relative ${isMobile ? "pt-14" : ""}`}>
        {/* Persistent dashboard iframe (hidden when not on /dashboard, and never rendered for users without access) */}
        {!isMobile && canViewDashboard && <PersistentDashboard ref={dashboardRef} visible={isDashboard} />}

        {/* Normal routed content - hide when dashboard iframe is showing on desktop */}
        <div className="min-w-0 overflow-x-hidden" style={isDashboard && !isMobile && canViewDashboard ? { visibility: "hidden" } : undefined}>
          <Outlet context={{ dashboardRef }} />
        </div>
      </main>
    </div>
  );
}
