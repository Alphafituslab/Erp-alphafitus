import { useState, useRef } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Truck,
  Users,
  FolderKanban,
  FileText,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  Download,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useGetExecutiveDashboard, useGetMyTasks } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (v: string | number | null | undefined) =>
  parseFloat(String(v ?? "0")).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const fmtPct = (current: string, previous: string) => {
  const cur = parseFloat(current);
  const prev = parseFloat(previous);
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subValue,
  icon: Icon,
  iconColor,
  trend,
  href,
  isCurrency = false,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: number | null;
  href?: string;
  isCurrency?: boolean;
}) {
  const displayValue = isCurrency ? fmtCurrency(String(value)) : String(value);

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold mt-1 truncate">{displayValue}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
            {trend != null && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
                trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-muted-foreground"
              }`}>
                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {trend !== 0 ? `${Math.abs(trend).toFixed(1)}% vs período anterior` : "Igual ao período anterior"}
              </div>
            )}
          </div>
          <div className={`rounded-lg p-2.5 ${iconColor} flex-shrink-0`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        {href && (
          <Link href={href}>
            <a className="absolute inset-0" aria-label={`Ir para ${title}`} />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ── Module quick-links ────────────────────────────────────────────────────────

const MODULES = [
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, color: "bg-emerald-500" },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart, color: "bg-blue-500" },
  { href: "/estoque", label: "Estoque", icon: Package, color: "bg-amber-500" },
  { href: "/compras", label: "Compras", icon: Truck, color: "bg-purple-500" },
  { href: "/rh", label: "RH", icon: Users, color: "bg-pink-500" },
  { href: "/projetos", label: "Projetos", icon: FolderKanban, color: "bg-indigo-500" },
  { href: "/fiscal", label: "Fiscal", icon: FileText, color: "bg-orange-500" },
  { href: "/qualidade", label: "Qualidade", icon: BarChart2, color: "bg-teal-500" },
];

// ── Employee view — My Tasks summary ─────────────────────────────────────────

function EmployeeDashboard() {
  const { data: tasks, isLoading } = useGetMyTasks();

  const todo = tasks?.filter((t) => t.status === "todo") ?? [];
  const inProgress = tasks?.filter((t) => t.status === "in_progress") ?? [];
  const overdue = tasks?.filter(
    (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-blue-600">{isLoading ? "…" : inProgress.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Em andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-gray-700">{isLoading ? "…" : todo.length}</p>
            <p className="text-sm text-muted-foreground mt-1">A fazer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-red-600">{isLoading ? "…" : overdue.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Atrasadas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Minhas Tarefas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (tasks?.length ?? 0) === 0 ? (
            <p className="text-center py-10 text-muted-foreground">Nenhuma tarefa atribuída</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks?.slice(0, 10).map((t) => {
                  const isOverdue = t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date();
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="text-muted-foreground">{t.projectName ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          t.status === "done" ? "bg-green-100 text-green-800"
                          : t.status === "in_progress" ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-700"
                        }`}>
                          {t.status === "done" ? "Concluído" : t.status === "in_progress" ? "Em andamento" : "A fazer"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${
                          t.priority === "urgent" ? "text-red-600"
                          : t.priority === "high" ? "text-orange-600"
                          : t.priority === "medium" ? "text-yellow-700"
                          : "text-gray-500"
                        }`}>
                          {t.priority === "urgent" ? "Urgente" : t.priority === "high" ? "Alta" : t.priority === "medium" ? "Média" : "Baixa"}
                        </span>
                      </TableCell>
                      <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                        {t.dueDate
                          ? new Date(t.dueDate).toLocaleDateString("pt-BR")
                          : "—"}
                        {isOverdue && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-3">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <a className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className={`rounded-md p-2 ${m.color}`}>
                <m.icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">{m.label}</span>
              <ArrowUpRight className="h-3 w-3 ml-auto text-muted-foreground" />
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Executive dashboard ───────────────────────────────────────────────────────

type PeriodKey = "this_month" | "last_month" | "this_quarter" | "this_year";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  this_quarter: "Este trimestre",
  this_year: "Este ano",
};

function ExecutiveDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data, isLoading } = useGetExecutiveDashboard({ period });

  const kpis = data?.kpis;
  const trend = data?.monthlyTrend ?? [];
  const topClients = data?.topClients ?? [];
  const topProducts = data?.topProducts ?? [];

  const revTrend = kpis ? fmtPct(kpis.revenueTotal, kpis.revenueLastPeriod) : null;
  const expTrend = kpis ? fmtPct(kpis.expenseTotal, kpis.expenseLastPeriod) : null;
  const netVal = kpis ? parseFloat(kpis.netBalance) : 0;

  async function handleExportPdf() {
    if (!printRef.current || isLoading) return;
    setExporting(true);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const elW = printRef.current.offsetWidth;
      const elH = printRef.current.offsetHeight;

      const imgData = await toPng(printRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentW = pageW - margin * 2;
      const imgH = (elH * contentW) / elW;

      const periodSlug = (data?.periodLabel ?? period)
        .toLowerCase()
        .replace(/\//g, "-")
        .replace(/\s+/g, "-");
      const filename = `relatorio-executivo-${periodSlug}.pdf`;

      let yOffset = 0;
      while (yOffset < imgH) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, margin - yOffset, contentW, imgH);
        yOffset += pageH - margin * 2;
      }

      pdf.save(filename);
    } catch {
      toast({
        title: "Erro ao exportar PDF",
        description: "Não foi possível gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Period selector + Export button */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Período:</span>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PERIOD_LABELS) as [PeriodKey, string][]).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data?.periodLabel && (
          <span className="text-sm text-muted-foreground">({data.periodLabel})</span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={handleExportPdf}
          disabled={isLoading || exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {exporting ? "Gerando PDF…" : "Exportar PDF"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Printable area — captured by html2canvas for PDF export */}
          <div ref={printRef} className="space-y-6 bg-white">
          {/* KPI Cards — financial */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Receita"
              value={kpis?.revenueTotal ?? "0"}
              icon={TrendingUp}
              iconColor="bg-emerald-500"
              trend={revTrend}
              isCurrency
            />
            <KpiCard
              title="Despesas"
              value={kpis?.expenseTotal ?? "0"}
              icon={TrendingDown}
              iconColor="bg-red-500"
              trend={expTrend != null ? -expTrend : null}
              isCurrency
            />
            <KpiCard
              title="Saldo Líquido"
              value={kpis?.netBalance ?? "0"}
              icon={DollarSign}
              iconColor={netVal >= 0 ? "bg-blue-500" : "bg-orange-500"}
              isCurrency
            />
            <KpiCard
              title="Pedidos de Venda Abertos"
              value={kpis?.openSalesOrders ?? 0}
              icon={ShoppingCart}
              iconColor="bg-blue-500"
              href="/vendas"
            />
          </div>

          {/* KPI Cards — operations */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Produtos em Estoque Baixo"
              value={kpis?.lowStockProducts ?? 0}
              icon={AlertTriangle}
              iconColor={(kpis?.lowStockProducts ?? 0) > 0 ? "bg-amber-500" : "bg-gray-400"}
              href="/estoque"
            />
            <KpiCard
              title="Compras Pendentes"
              value={kpis?.pendingPurchaseOrders ?? 0}
              icon={Truck}
              iconColor="bg-purple-500"
              href="/compras"
            />
            <KpiCard
              title="Funcionários Ativos"
              value={kpis?.activeEmployees ?? 0}
              icon={Users}
              iconColor="bg-pink-500"
              href="/rh"
            />
            <KpiCard
              title="Projetos Ativos"
              value={kpis?.activeProjects ?? 0}
              icon={FolderKanban}
              iconColor="bg-indigo-500"
              href="/projetos"
            />
          </div>

          {/* Revenue vs Expenses chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receita vs Despesas — Últimos 12 Meses</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(0, 6)}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                      name === "revenue" ? "Receita" : name === "expense" ? "Despesa" : "Saldo",
                    ]}
                  />
                  <Legend
                    formatter={(v: string) =>
                      v === "revenue" ? "Receita" : v === "expense" ? "Despesa" : "Saldo Líquido"
                    }
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]} name="revenue" />
                  <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} name="expense" />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="net"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top clients + Top products */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 5 clients */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 Clientes por Receita</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {topClients.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Sem dados de vendas</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topClients.map((c, i) => (
                        <TableRow key={c.clientId}>
                          <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                          <TableCell className="font-medium truncate max-w-[140px]">{c.clientName}</TableCell>
                          <TableCell className="text-right text-sm">{c.orderCount}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtCurrency(c.totalRevenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Top 5 products by movement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 Produtos por Movimentação</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {topProducts.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Sem movimentações de estoque</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Movimentações</TableHead>
                        <TableHead className="text-right">Qty Líquida</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((p, i) => (
                        <TableRow key={p.productId}>
                          <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                          <TableCell className="font-medium truncate max-w-[140px]">{p.productName}</TableCell>
                          <TableCell className="text-right text-sm">{p.movementCount}</TableCell>
                          <TableCell className={`text-right font-semibold ${p.netQuantity >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {p.netQuantity >= 0 ? "+" : ""}{p.netQuantity}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
          </div>{/* end printRef */}

          {/* Quick links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acesso Rápido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {MODULES.map((m) => (
                  <Link key={m.href} href={m.href}>
                    <a className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
                      <div className={`rounded-md p-2 ${m.color}`}>
                        <m.icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium">{m.label}</span>
                      <ArrowUpRight className="h-3 w-3 ml-auto text-muted-foreground" />
                    </a>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEmployee ? "Minhas Tarefas" : "Dashboard Gerencial"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isEmployee
              ? "Suas tarefas atribuídas e acesso aos módulos"
              : "Visão executiva consolidada de todos os módulos"}
          </p>
        </div>

        {isEmployee ? <EmployeeDashboard /> : <ExecutiveDashboard />}
      </div>
    </AppLayout>
  );
}
