import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { WixAuthProvider } from "@/contexts/WixAuthContext";
import { TierProvider } from "@/contexts/TierContext";
import { AppLayout } from "@/components/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import NewAnalysis from "./pages/NewAnalysis";
import Dashboard from "./pages/Dashboard";
import MarketReports from "./pages/MarketReports";
import LocationReports from "./pages/LocationReports";
import AppraisalRequest from "./pages/AppraisalRequest";
import Login from "./pages/Login";
import WixCallback from "./pages/WixCallback";
import NotFound from "./pages/NotFound";
import ImportData from "./pages/ImportData";
import ChatWidget from "./pages/ChatWidget";
import ChatWidgetMinimal from "./pages/ChatWidgetMinimal";
import SharedConversation from "./pages/SharedConversation";
import AdminChatLogs from "./pages/AdminChatLogs";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminAppraisals from "./pages/AdminAppraisals";
import AdminUsers from "./pages/AdminUsers";
import AdminAlerts from "./pages/AdminAlerts";
import CampaignConversation from "./pages/CampaignConversation";
import AdminAffiliates from "./pages/AdminAffiliates";
import DashboardV2 from "./pages/DashboardV2";

import { PageViewTracker } from "@/components/PageViewTracker";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation();
  const isWidgetRoute = location.pathname === "/widget" || location.pathname === "/widget-minimal";
  useAffiliateTracking();

  useEffect(() => {
    document.documentElement.style.background = isWidgetRoute ? "transparent" : "";
    document.body.style.background = isWidgetRoute ? "transparent" : "";

    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, [isWidgetRoute]);

  return (
    <div
      className="w-full overflow-x-hidden"
      style={{ minHeight: isWidgetRoute ? "auto" : "100vh", background: isWidgetRoute ? "transparent" : "hsl(var(--background))" }}
    >
      <PageViewTracker />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<WixCallback />} />
        <Route path="/widget" element={<ChatWidget />} />
        <Route path="/widget-minimal" element={<ChatWidgetMinimal />} />
        <Route path="/shared/:id" element={<SharedConversation />} />
        <Route path="/campaign/:slug" element={<CampaignConversation />} />
        <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
          <Route path="/" element={<NewAnalysis />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/market-reports" element={<MarketReports />} />
          <Route path="/location-reports" element={<LocationReports />} />
          <Route path="/appraisal-request" element={<AppraisalRequest />} />
        <Route path="/dashboard-v2" element={<DashboardV2 />} />
        <Route path="/__pie-test" element={<PieTest />} />

        </Route>
        <Route path="/import-data" element={<ImportData />} />
        <Route path="/admin/chat-logs" element={<AdminChatLogs />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/appraisals" element={<AdminAppraisals />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/alerts" element={<AdminAlerts />} />
        <Route path="/admin/affiliates" element={<AdminAffiliates />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WixAuthProvider>
        <TierProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TierProvider>
      </WixAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
