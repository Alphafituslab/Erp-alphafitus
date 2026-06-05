import { useAuth } from "@/contexts/auth";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  DollarSign, ShoppingCart, Package, Truck, Users, FolderKanban,
  FileText, BarChart2, ClipboardCheck, ArrowUpRight, TrendingUp,
  TrendingDown, AlertTriangle, CalendarX, Factory, Clock,
  PackageCheck, Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useGetExecutiveDashboard } from "@workspace/api-client-react";
import { useGetEstoqueDashboard } from "@workspace/api-client-react";

function fmt(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`;
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(curr: string | number, prev: string | number) {
  const c = Number(curr ?? 0);
  const p = Number(prev ?? 0);
  if (p === 0) return null;
  return ((c - p) / p) * 100;
}

const MODULES = [
  { href: "/financeiro", label: "Financeiro", description: "Contas a pagar, receber e fluxo de caixa", icon: DollarSign, color: "bg-emerald-500", light: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  { href: "/vendas", label: "Vendas", description: "Pedidos, orçamentos e clientes", icon: ShoppingCart, color: "bg-blue-500", light: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400" },
  { href: "/estoque", label: "Estoque", description: "Inventário, lotes e movimentações", icon: Package, color: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  { href: "/compras", label: "Compras", description: "Cotações, pedidos e fornecedores", icon: Truck, color: "bg-purple-500", light: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400" },
  { href: "/producao", label: "Produção", description: "Ordens, fórmulas e apontamento", icon: Factory, color: "bg-rose-500", light: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400" },
  { href: "/rh", label: "RH", description: "Funcionários, departamentos e presença", icon: Users, color: "bg-pink-500", light: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-600 dark:text-pink-400" },
  { href: "/projetos", label: "Projetos", description: "Cronogramas, tarefas e alocações", icon: FolderKanban, color: "bg-indigo-500", light: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-600 dark:text-indigo-400" },
  { href: "/fiscal", label: "Fiscal", description: "Notas fiscais e apuração de impostos", icon: FileText, color: "bg-orange-500", light: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400" },
  { href: "/qualidade", label: "Qualidade", description: "Inspeções, laudos e não conformidades", icon: ClipboardCheck, color: "bg-teal-500", light: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-600 dark:text-teal-400" },
  { href: "/relatorios", label: "Relatórios", description: "Indicadores executivos e dashboards", icon: BarChart2, color: "bg-primary", light: "bg-primary/10", text: "text-primary" },
];

function KpiCard({ title, value, sub, icon: Icon, trend, urgent }: {
  title: string; value: React.ReactNode; sub?: string; icon: React.ElementType;
  trend?: number | null; urgent?: boolean;
}) {
  return (
    <Card className={urgent ? "border-red-300 dark:border-red-800" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${urgent ? "text-red-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold tabular-nums ${urgent ? "text-red-600" : ""}`}>{value}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {trend != null && (
            trend >= 0
              ? <TrendingUp className="h-3 w-3 text-emerald-500" />
              : <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: exec } = useGetExecutiveDashboard({ period: "this_month" });
  const { data: estoque } = useGetEstoqueDashboard();

  const kpis = exec?.kpis;
  const trend = pct(kpis?.revenueTotal ?? 0, kpis?.revenueLastPeriod ?? 0);

  const chartData = (exec?.monthlyTrend ?? []).slice(-6).map((m: any) => ({
    mes: m.monthLabel,
    Receitas: Number(m.revenue),
    Despesas: Number(m.expense),
    Resultado: Number(m.net),
  }));

  const alerts: Array<{ label: string; count: number; href: string; color: string }> = [];
  if ((estoque as any)?.expiringLots30 > 0)
    alerts.push({ label: "Lotes vencendo (30d)", count: (estoque as any).expiringLots30, href: "/estoque", color: "text-red-600" });
  if ((estoque as any)?.quarantineLots > 0)
    alerts.push({ label: "Lotes em quarentena", count: (estoque as any).quarantineLots, href: "/estoque", color: "text-orange-600" });
  if ((estoque as any)?.lowStockCount > 0)
    alerts.push({ label: "Produtos abaixo do mínimo", count: (estoque as any).lowStockCount, href: "/estoque", color: "text-yellow-600" });
  if ((kpis?.pendingPurchaseOrders ?? 0) > 0)
    alerts.push({ label: "Pedidos de compra pendentes", count: kpis!.pendingPurchaseOrders, href: "/compras", color: "text-purple-600" });

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title={`Bem-vindo, ${user?.name?.split(" ")[0] || "Usuário"}`}
          subtitle="Painel executivo alphafitus ERP — visão consolidada do mês"
        />

        {/* ── KPIs principais ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            title="Receita"
            value={fmt(kpis?.revenueTotal)}
            sub={trend != null ? `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs mês anterior` : "mês atual"}
            icon={DollarSign}
            trend={trend}
          />
          <KpiCard
            title="Despesas"
            value={fmt(kpis?.expenseTotal)}
            sub="mês atual"
            icon={TrendingDown}
          />
          <KpiCard
            title="Pedidos Abertos"
            value={kpis?.openSalesOrders ?? 0}
            sub="vendas ativas"
            icon={ShoppingCart}
          />
          <KpiCard
            title="Estoque baixo"
            value={(estoque as any)?.lowStockCount ?? 0}
            sub="abaixo do mínimo"
            icon={Package}
            urgent={(estoque as any)?.lowStockCount > 0}
          />
          <KpiCard
            title="Colaboradores"
            value={kpis?.activeEmployees ?? 0}
            sub="ativos"
            icon={Users}
          />
          <KpiCard
            title="Projetos"
            value={kpis?.activeProjects ?? 0}
            sub="em andamento"
            icon={FolderKanban}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Gráfico tendência ──────────────────────────────────────── */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" /> Tendência — últimos 6 meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sem dados de tendência</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDesp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={45} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="Receitas" stroke="#10b981" fill="url(#gradRec)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Despesas" stroke="#f43f5e" fill="url(#gradDesp)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Alertas cross-módulo ───────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <PackageCheck className="h-7 w-7 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Tudo em ordem!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a, i) => (
                    <Link key={i} href={a.href}>
                      <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors">
                        <span className="text-sm text-foreground/80">{a.label}</span>
                        <Badge variant="outline" className={`text-xs font-semibold ${a.color}`}>{a.count}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Lotes próximos vencimento */}
              {(estoque as any)?.expiringLots60 > 0 && (
                <div className="mt-4 pt-3 border-t space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarX className="h-3 w-3" /> Validade de lotes</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">60 dias</span>
                    <span className="font-medium text-orange-600">{(estoque as any).expiringLots60} lotes</span>
                  </div>
                  {(estoque as any)?.expiringLots90 > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">90 dias</span>
                      <span className="font-medium text-yellow-600">{(estoque as any).expiringLots90} lotes</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Top clientes / top produtos ─────────────────────────────── */}
        {((exec?.topClients?.length ?? 0) > 0 || (exec?.topProducts?.length ?? 0) > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(exec?.topClients?.length ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Top Clientes (mês)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {exec!.topClients!.slice(0, 4).map((c: any, i: number) => (
                    <div key={c.clientId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="truncate">{c.clientName}</span>
                      </div>
                      <span className="font-medium tabular-nums text-xs shrink-0 ml-2">{fmt(c.totalRevenue)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(exec?.topProducts?.length ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Produtos mais movimentados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {exec!.topProducts!.slice(0, 4).map((p: any, i: number) => (
                    <div key={p.productId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="truncate">{p.productName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{p.movementCount} mov.</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Grade de módulos ────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Acesso rápido
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {MODULES.map((mod) => (
              <Link key={mod.href} href={mod.href} className="block group">
                <Card className="h-full transition-all duration-150 hover:border-primary/40 hover:shadow-sm cursor-pointer">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-7 w-7 rounded-md ${mod.light} flex items-center justify-center flex-shrink-0`}>
                        <mod.icon className={`h-3.5 w-3.5 ${mod.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold">{mod.label}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
