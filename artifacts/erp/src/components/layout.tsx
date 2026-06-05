import { ReactNode, useEffect, useState } from "react";
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
  Factory,
  CalendarClock,
  GitBranch,
  UserCog,
  ChevronRight,
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
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-2 rounded-full bg-primary/10" />
          </div>
          <span className="text-sm text-muted-foreground font-medium">Carregando sistema…</span>
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
    <SidebarGroup className="py-0.5">
      <SidebarGroupLabel className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30 px-3 mb-1 mt-2">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.items.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "relative h-8 rounded-md px-3 text-sidebar-foreground/65 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent transition-all duration-150",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  )}
                >
                  <Link href={item.href}>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_6px_1px_rgba(52,211,153,0.35)]" />
                    )}
                    <item.icon
                      className={cn(
                        "size-3.5 flex-shrink-0 transition-colors",
                        isActive ? "text-sidebar-primary" : item.iconColor
                      )}
                    />
                    <span className="text-[13px] tracking-[-0.01em]">{item.label}</span>
                    {isActive && <ChevronRight className="ml-auto size-3 text-sidebar-foreground/30" />}
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

function TopbarClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  return (
    <span className="text-xs text-muted-foreground/70 tabular-nums hidden lg:block capitalize">
      {dateStr}
    </span>
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

  const currentItem = NAV_GROUPS.flatMap((g) => g.items).find(
    (i) => location === i.href || location.startsWith(i.href + "/")
  );
  const currentLabel = currentItem?.label ?? "alphafitus ERP";
  const CurrentIcon = currentItem?.icon;

  const userInitials = user?.name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "?";

  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    manager: "Gerente",
    employee: "Colaborador",
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <Sidebar
          variant="inset"
          collapsible="icon"
          className="border-r border-sidebar-border/50 bg-sidebar"
          style={{ background: "linear-gradient(180deg, hsl(168 52% 7%) 0%, hsl(168 48% 6%) 100%)" }}
        >
          {/* Logo */}
          <SidebarHeader className="px-4 py-4 border-b border-sidebar-border/40">
            <div className="flex items-center gap-2.5 px-0.5">
              <div className="flex-shrink-0 h-7 w-7 rounded-lg overflow-hidden ring-1 ring-sidebar-primary/20">
                <img
                  src={`${import.meta.env.BASE_URL}logo-alphafitus.png`}
                  alt="alphafitus"
                  className="h-7 w-7 object-contain"
                />
              </div>
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="font-bold text-[13px] text-sidebar-foreground tracking-tight">alphafitus</span>
                <span className="text-[9.5px] text-sidebar-foreground/40 tracking-[0.1em] uppercase font-medium">Industrial ERP</span>
              </div>
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="pt-1 pb-2 overflow-y-auto">
            {visibleGroups.map((group) => (
              <NavGroupSection key={group.label} group={group} location={location} />
            ))}
          </SidebarContent>

          {/* User footer */}
          <SidebarFooter className="border-t border-sidebar-border/40 p-3">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-7 w-7 flex-shrink-0 ring-1 ring-sidebar-primary/30">
                <AvatarFallback className="text-[10px] font-bold text-sidebar-primary bg-sidebar-primary/10">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <span className="text-[12px] font-semibold text-sidebar-foreground/90 truncate leading-tight">
                  {user?.name}
                </span>
                <span className="text-[10px] text-sidebar-foreground/40 truncate">
                  {roleLabel[userRole] ?? userRole}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Sair do sistema</TooltipContent>
              </Tooltip>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top header bar */}
          <header className="h-13 flex items-center gap-4 border-b border-border/70 bg-card px-5 shrink-0"
                  style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)" }}>

            {/* Left: current module label */}
            <div className="flex items-center gap-2.5 min-w-0">
              {CurrentIcon && (
                <div className="h-6 w-6 rounded-md bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <CurrentIcon className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <span className="text-sm font-semibold text-foreground truncate">{currentLabel}</span>
            </div>

            {/* Right: date + user */}
            <div className="ml-auto flex items-center gap-4">
              <TopbarClock />
              <div className="h-5 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden md:block">
                  <p className="text-xs font-semibold text-foreground leading-tight">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{roleLabel[userRole] ?? userRole}</p>
                </div>
                <Avatar className="h-7 w-7 ring-1 ring-border">
                  <AvatarFallback className="text-[10px] font-bold text-primary bg-primary/8">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
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
