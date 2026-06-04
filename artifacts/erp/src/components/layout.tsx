import { ReactNode } from "react";
import { useAuth } from "@/contexts/auth";
import { Redirect } from "wouter";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
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
  LayoutDashboard,
  ClipboardCheck,
  ChevronRight,
  Factory,
  CalendarClock,
  GitBranch,
  UserCog,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  iconColor?: string;
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
  roles?: string[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Painel",
    items: [
      { href: "/relatorios", label: "Relatórios", icon: BarChart2, iconColor: "text-emerald-400" },
      { href: "/dashboard", label: "Módulos", icon: LayoutDashboard, iconColor: "text-sky-400" },
    ],
  },
  {
    label: "Operações",
    items: [
      { href: "/vendas", label: "Vendas", icon: ShoppingCart, iconColor: "text-blue-400" },
      { href: "/estoque", label: "Estoque", icon: Package, iconColor: "text-amber-400" },
      { href: "/compras", label: "Compras", icon: Truck, iconColor: "text-purple-400" },
      { href: "/producao", label: "Produção", icon: Factory, iconColor: "text-rose-400" },
      { href: "/aps", label: "APS / Gantt", icon: CalendarClock, iconColor: "text-cyan-400" },
      { href: "/qualidade", label: "Qualidade", icon: ClipboardCheck, iconColor: "text-teal-400" },
      { href: "/rastreabilidade", label: "Rastreabilidade", icon: GitBranch, iconColor: "text-violet-400" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/financeiro", label: "Financeiro", icon: DollarSign, iconColor: "text-emerald-400" },
      { href: "/fiscal", label: "Fiscal", icon: FileText, iconColor: "text-orange-400" },
      { href: "/rh", label: "RH", icon: Users, iconColor: "text-pink-400" },
      { href: "/projetos", label: "Projetos", icon: FolderKanban, iconColor: "text-indigo-400" },
    ],
  },
  {
    label: "Administração",
    roles: ["admin"],
    items: [
      { href: "/usuarios", label: "Usuários", icon: UserCog, iconColor: "text-rose-400", roles: ["admin"] },
    ],
  },
];

function NavGroupSection({ group, location }: { group: NavGroup; location: string }) {
  return (
    <SidebarGroup className="py-1">
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-0.5">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "relative h-9 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  )}
                >
                  <Link href={item.href}>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-sidebar-primary" />
                    )}
                    <item.icon className={cn("size-4 flex-shrink-0", isActive ? "text-sidebar-primary" : item.iconColor)} />
                    <span className="text-sm">{item.label}</span>
                    {isActive && <ChevronRight className="ml-auto size-3 opacity-50" />}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

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
      },
    });
  };

  const userRole = user?.role ?? "employee";

  const visibleGroups = NAV_GROUPS
    .filter((g) => !g.roles || g.roles.includes(userRole))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(userRole)) }))
    .filter((g) => g.items.length > 0);

  const currentLabel =
    NAV_GROUPS.flatMap((g) => g.items).find(
      (i) => location === i.href || location.startsWith(i.href + "/")
    )?.label ?? "alphafitus ERP";

  const userInitials = user?.name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "?";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <Sidebar variant="inset" collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
          {/* Logo header */}
          <SidebarHeader className="px-3 py-4 border-b border-sidebar-border/60">
            <div className="flex items-center gap-2.5 px-1">
              <div className="flex-shrink-0 h-7 w-7 rounded-md overflow-hidden flex items-center justify-center">
                <img
                  src={`${import.meta.env.BASE_URL}logo-alphafitus.png`}
                  alt="alphafitus"
                  className="h-7 w-7 object-contain"
                />
              </div>
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="font-bold text-sm text-sidebar-foreground tracking-tight">alphafitus</span>
                <span className="text-[10px] text-sidebar-foreground/50 tracking-wider uppercase">Industrial ERP</span>
              </div>
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="pt-2 pb-2">
            {visibleGroups.map((group) => (
              <NavGroupSection key={group.label} group={group} location={location} />
            ))}
          </SidebarContent>

          {/* User footer */}
          <SidebarFooter className="border-t border-sidebar-border/60 p-3">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-sidebar-border bg-sidebar-accent">
                <AvatarFallback className="text-sidebar-foreground text-xs font-semibold bg-transparent">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <span className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                  {user?.name}
                </span>
                <span className="text-[10px] text-sidebar-foreground/50 truncate capitalize">
                  {user?.role}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main content area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-12 flex items-center gap-3 border-b bg-card px-5 shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-xs font-medium text-foreground/80">{currentLabel}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* slot for top-right actions */}
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-auto bg-background p-5 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
