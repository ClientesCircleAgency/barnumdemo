import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// #region agent log — Global Error Boundary to catch React crashes
class DebugErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) {
    console.error('[DBG-H3] REACT ERROR BOUNDARY CAUGHT:', error?.message, error?.stack?.slice(0, 500), info?.componentStack?.slice(0, 500));
    fetch('http://127.0.0.1:7242/ingest/db4a717c-c15f-476b-beb5-b5461f60195e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:ErrorBoundary',message:'REACT CRASH CAUGHT',data:{error:error?.message,stack:error?.stack?.slice(0,300),componentStack:info?.componentStack?.slice(0,300)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
  }
  render() {
    if (this.state.hasError) return <div style={{padding:'2rem',color:'red',fontFamily:'monospace'}}><h2>Erro na aplicação</h2><pre>{this.state.error?.message}</pre><button onClick={()=>this.setState({hasError:false,error:null})}>Tentar novamente</button></div>;
    return this.props.children;
  }
}
// #endregion
import Index from "./pages/Index";
import AdminLogin from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./components/admin/AdminLayout";
import { ProtectedRoute } from "./components/admin/ProtectedRoute";
import DashboardPage from "./pages/admin/DashboardPage";
import AgendaPage from "./pages/admin/AgendaPage";
import PatientsPage from "./pages/admin/PatientsPage";
import PatientDetailPage from "./pages/admin/PatientDetailPage";
import WaitlistPage from "./pages/admin/WaitlistPage";
import WaitingRoomPage from "./pages/admin/WaitingRoomPage";
import SettingsPage from "./pages/admin/SettingsPage";
import RequestsPage from "./pages/admin/RequestsPage";
import PlanPage from "./pages/admin/PlanPage";
import StatisticsPage from "./pages/admin/StatisticsPage";

const queryClient = new QueryClient();

const App = () => (
  <DebugErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="pedidos" element={<RequestsPage />} />
            <Route path="pacientes" element={<PatientsPage />} />
            <Route path="pacientes/:id" element={<PatientDetailPage />} />
            <Route path="lista-espera" element={<WaitlistPage />} />
            <Route path="sala-espera" element={<WaitingRoomPage />} />
            <Route 
              path="configuracoes" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'secretary']}>
                  <SettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route path="plano" element={<PlanPage />} />
            <Route 
              path="estatisticas" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StatisticsPage />
                </ProtectedRoute>
              } 
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </DebugErrorBoundary>
);

export default App;
