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
import ModulePlaceholderPage from "@/pages/module";

const queryClient = new QueryClient();

function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Redirect to="/dashboard" />;
  return <Redirect to="/login" />;
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

      <Route path="/financeiro">
        <ProtectedRoute>
          <FinanceiroPage />
        </ProtectedRoute>
      </Route>

      <Route path="/vendas">
        <ProtectedRoute>
          <VendasPage />
        </ProtectedRoute>
      </Route>

      <Route path="/estoque">
        <ProtectedRoute>
          <EstoquePage />
        </ProtectedRoute>
      </Route>

      <Route path="/qualidade">
        <ProtectedRoute>
          <QualidadePage />
        </ProtectedRoute>
      </Route>

      <Route path="/compras">
        <ProtectedRoute>
          <ComprasPage />
        </ProtectedRoute>
      </Route>

      <Route path="/rh">
        <ProtectedRoute>
          <RhPage />
        </ProtectedRoute>
      </Route>

      <Route path="/:module(projetos|fiscal|relatorios)">
        <ProtectedRoute>
          <ModulePlaceholderPage />
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
