import { ReactNode } from "react";
import { useAuth } from "@/contexts/auth";
import { Redirect } from "wouter";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Truck, 
  Users, 
  FolderKanban, 
  FileText, 
  BarChart2, 
  LogOut,
  Hexagon,
  LayoutDashboard,
  ClipboardCheck
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-background text-muted-foreground">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/estoque", label: "Estoque", icon: Package },
  { href: "/compras", label: "Compras", icon: Truck },
  { href: "/rh", label: "RH", icon: Users },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/fiscal", label: "Fiscal", icon: FileText },
  { href: "/qualidade", label: "Qualidade", icon: ClipboardCheck },
  { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      }
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <Sidebar variant="inset" className="border-r border-sidebar-border bg-sidebar">
          <SidebarHeader className="p-4 flex items-center gap-3">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Hexagon className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-semibold text-sidebar-foreground">NEXUS ERP</span>
              <span className="text-xs text-sidebar-foreground/60">Sistema Integrado</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild
                        isActive={location === item.href}
                        tooltip={item.label}
                      >
                        <Link href={item.href} className="flex items-center gap-3 w-full">
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 bg-sidebar-accent border border-sidebar-border">
                <AvatarFallback className="text-sidebar-foreground font-medium text-xs bg-transparent">
                  {user?.name?.substring(0, 2).toUpperCase() || "UN"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</span>
                <span className="text-xs text-sidebar-foreground/60 truncate capitalize">{user?.role}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 lg:h-16 flex items-center justify-between border-b bg-card px-6 shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-sm font-medium tracking-tight text-foreground/80">
                {NAV_ITEMS.find((i) => i.href === location)?.label || "Nexus ERP"}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Optional top bar items */}
            </div>
          </header>
          <div className="flex-1 overflow-auto bg-background p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
