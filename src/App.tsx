import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TierProvider } from "@/contexts/TierContext";
import { AppLayout } from "@/components/AppLayout";
import NewAnalysis from "./pages/NewAnalysis";
import Dashboard from "./pages/Dashboard";
import MarketReports from "./pages/MarketReports";
import LocationReports from "./pages/LocationReports";
import AppraisalRequest from "./pages/AppraisalRequest";
import NotFound from "./pages/NotFound";
import ImportData from "./pages/ImportData";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TierProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<NewAnalysis />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/market-reports" element={<MarketReports />} />
              <Route path="/location-reports" element={<LocationReports />} />
              <Route path="/appraisal-request" element={<AppraisalRequest />} />
            </Route>
            <Route path="/import-data" element={<ImportData />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TierProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
