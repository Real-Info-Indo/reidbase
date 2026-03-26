import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSessionEnforcement } from "@/hooks/useSessionEnforcement";
import reidLogo from "@/assets/REID_Black.svg";

export function AppLayout() {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Enforce single-device sessions for paid tiers
  useSessionEnforcement();

  return (
    <div className="flex min-h-screen w-full relative">
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
            : ""
        }
        style={isMobile ? { height: 'calc(100dvh - 3.5rem)' } : undefined}
      >
        <AppSidebar onNavigate={() => setMobileMenuOpen(false)} isMobile={isMobile} />
      </div>

      {/* Main content */}
      <main className={`flex-1 overflow-auto bg-background ${isMobile ? "pt-14" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}
