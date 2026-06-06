import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Component, type ReactNode } from "react";
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

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
          <div className="bg-white rounded-xl shadow border border-red-100 p-8 max-w-lg w-full">
            <h1 className="text-xl font-bold text-red-600 mb-2">Erro na aplicação</h1>
            <p className="text-gray-600 text-sm mb-4">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <pre className="bg-gray-50 border rounded p-3 text-xs text-gray-700 overflow-auto max-h-40">
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm font-medium"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
              <Toaster />
            </AuthProvider>
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
