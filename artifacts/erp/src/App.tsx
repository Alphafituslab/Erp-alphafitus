import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { ProtectedRoute } from "@/components/layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import FinanceiroPage from "@/pages/financeiro";
import VendasPage from "@/pages/vendas";
import EstoquePage from "@/pages/estoque";
import ComprasPage from "@/pages/compras";
import QualidadePage from "@/pages/qualidade";
import RhPage from "@/pages/rh";
import ProjetosPage from "@/pages/projetos";
import FiscalPage from "@/pages/fiscal";
import RelatoriosPage from "@/pages/relatorios";
import ProducaoPage from "@/pages/producao";
import ApsPage from "@/pages/aps";
import RastreabilidadePage from "@/pages/rastreabilidade";
import UsuariosPage from "@/pages/usuarios";
import ConfiguracoesPage from "@/pages/configuracoes";

const queryClient = new QueryClient();

function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Redirect to="/relatorios" />;
  return <Redirect to="/login" />;
}

function ModuleGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { user, isLoading, canAccessModule } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  if (!canAccessModule(module)) return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/login" component={LoginPage} />

      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>

      <Route path="/relatorios">
        <ModuleGuard module="relatorios">
          <RelatoriosPage />
        </ModuleGuard>
      </Route>

      <Route path="/financeiro">
        <ModuleGuard module="financeiro">
          <FinanceiroPage />
        </ModuleGuard>
      </Route>

      <Route path="/vendas">
        <ModuleGuard module="vendas">
          <VendasPage />
        </ModuleGuard>
      </Route>

      <Route path="/estoque">
        <ModuleGuard module="estoque">
          <EstoquePage />
        </ModuleGuard>
      </Route>

      <Route path="/compras">
        <ModuleGuard module="compras">
          <ComprasPage />
        </ModuleGuard>
      </Route>

      <Route path="/qualidade">
        <ModuleGuard module="qualidade">
          <QualidadePage />
        </ModuleGuard>
      </Route>

      <Route path="/producao">
        <ModuleGuard module="producao">
          <ProducaoPage />
        </ModuleGuard>
      </Route>

      <Route path="/aps">
        <ModuleGuard module="aps">
          <ApsPage />
        </ModuleGuard>
      </Route>

      <Route path="/rastreabilidade">
        <ModuleGuard module="rastreabilidade">
          <RastreabilidadePage />
        </ModuleGuard>
      </Route>

      <Route path="/rh">
        <ModuleGuard module="rh">
          <RhPage />
        </ModuleGuard>
      </Route>

      <Route path="/projetos">
        <ModuleGuard module="projetos">
          <ProjetosPage />
        </ModuleGuard>
      </Route>

      <Route path="/fiscal">
        <ModuleGuard module="fiscal">
          <FiscalPage />
        </ModuleGuard>
      </Route>

      <Route path="/usuarios">
        <ProtectedRoute>
          <UsuariosPage />
        </ProtectedRoute>
      </Route>

      <Route path="/configuracoes">
        <ProtectedRoute>
          <ConfiguracoesPage />
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
