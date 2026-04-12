import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import AdminChatLogs from "./pages/AdminChatLogs";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminAppraisals from "./pages/AdminAppraisals";
import AdminUsers from "./pages/AdminUsers";
import AdminAlerts from "./pages/AdminAlerts";
import { PageViewTracker } from "@/components/PageViewTracker";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WixAuthProvider>
        <TierProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PageViewTracker />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/callback" element={<WixCallback />} />
              <Route path="/widget" element={<ChatWidget />} />
              <Route path="/widget-minimal" element={<ChatWidgetMinimal />} />
              <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
                <Route path="/" element={<NewAnalysis />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/market-reports" element={<MarketReports />} />
                <Route path="/location-reports" element={<LocationReports />} />
                <Route path="/appraisal-request" element={<AppraisalRequest />} />
              </Route>
              <Route path="/import-data" element={<ImportData />} />
              <Route path="/admin/chat-logs" element={<AdminChatLogs />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/appraisals" element={<AdminAppraisals />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/alerts" element={<AdminAlerts />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TierProvider>
      </WixAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
