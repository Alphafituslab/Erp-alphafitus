import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Target,
  Settings,
  Mail,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
import {
  useGetExecutiveDashboard,
  useGetMyTasks,
  useGetDashboardGoals,
  useUpsertDashboardGoals,
  useSendRelatorioEmail,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ progress, alert }: { progress: number; alert?: boolean }) {
  const pct = Math.min(100, Math.max(0, progress));
  const color = alert
    ? "bg-red-500"
    : pct >= 100
    ? "bg-emerald-500"
    : pct >= 70
    ? "bg-amber-400"
    : "bg-red-400";

  return (
    <div className="mt-2">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {pct.toFixed(0)}% da meta
      </p>
    </div>
  );
}

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
  goalValue,
  goalProgress,
  isAlert,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: number | null;
  href?: string;
  isCurrency?: boolean;
  goalValue?: string | number | null;
  goalProgress?: number | null;
  isAlert?: boolean;
}) {
  const displayValue = isCurrency ? fmtCurrency(String(value)) : String(value);
  const displayGoal = goalValue != null
    ? isCurrency
      ? fmtCurrency(String(goalValue))
      : `Meta: ${goalValue}`
    : null;

  return (
    <Card className={`relative overflow-hidden transition-shadow ${href ? "hover:shadow-md cursor-pointer" : ""} ${isAlert ? "ring-2 ring-red-400" : ""}`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${iconColor}`} />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
            <p className="text-2xl font-bold mt-1.5 tabular-nums truncate leading-none">{displayValue}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
            {displayGoal && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Meta: {isCurrency ? fmtCurrency(String(goalValue)) : goalValue}
              </p>
            )}
            {trend != null && goalProgress == null && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-500" : "text-muted-foreground"
              }`}>
                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                <span>{trend !== 0 ? `${trend > 0 ? "+" : ""}${trend.toFixed(1)}% vs período ant.` : "Estável"}</span>
              </div>
            )}
            {goalProgress != null && (
              <ProgressBar progress={goalProgress} alert={isAlert} />
            )}
          </div>
          <div className={`rounded-xl p-2.5 ${iconColor} flex-shrink-0 opacity-90`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        {href && (
          <Link href={href} className="absolute inset-0" aria-label={`Ir para ${title}`} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Goals Configuration Dialog ────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function GoalsDialog({ currentYear, currentMonth }: { currentYear: number; currentMonth: number }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [revenueGoal, setRevenueGoal] = useState("");
  const [expenseGoal, setExpenseGoal] = useState("");
  const [salesOrdersGoal, setSalesOrdersGoal] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingGoals, isLoading: goalsLoading } = useGetDashboardGoals(
    open ? year : 0,
    open ? month : 0,
  );

  useEffect(() => {
    if (existingGoals) {
      setRevenueGoal(parseFloat(existingGoals.revenueGoal).toFixed(2));
      setExpenseGoal(parseFloat(existingGoals.expenseGoal).toFixed(2));
      setSalesOrdersGoal(String(existingGoals.salesOrdersGoal));
    }
  }, [existingGoals]);

  const { mutate: upsertGoals, isPending } = useUpsertDashboardGoals({
    mutation: {
      onSuccess: () => {
        toast({ title: "Metas salvas com sucesso!" });
        queryClient.invalidateQueries({ queryKey: ["/api/relatorios/dashboard"] });
        queryClient.invalidateQueries({ queryKey: [`/api/relatorios/goals/${year}/${month}`] });
        setOpen(false);
      },
      onError: () => {
        toast({
          title: "Erro ao salvar metas",
          description: "Verifique os valores e tente novamente.",
          variant: "destructive",
        });
      },
    },
  });

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setYear(currentYear);
      setMonth(currentMonth);
      setRevenueGoal(existingGoals ? parseFloat(existingGoals.revenueGoal).toFixed(2) : "");
      setExpenseGoal(existingGoals ? parseFloat(existingGoals.expenseGoal).toFixed(2) : "");
      setSalesOrdersGoal(existingGoals ? String(existingGoals.salesOrdersGoal) : "");
    }
  }

  function handleMonthYearChange(newYear: number, newMonth: number) {
    setYear(newYear);
    setMonth(newMonth);
    setRevenueGoal("");
    setExpenseGoal("");
    setSalesOrdersGoal("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    upsertGoals({
      year,
      month,
      data: {
        revenueGoal: String(parseFloat(revenueGoal) || 0),
        expenseGoal: String(parseFloat(expenseGoal) || 0),
        salesOrdersGoal: parseInt(salesOrdersGoal) || 0,
      },
    });
  }

  const currentYears = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Target className="h-4 w-4 mr-2" />
          Configurar Metas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Metas Mensais
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Mês</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => handleMonthYearChange(year, parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ano</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => handleMonthYearChange(parseInt(v), month)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {goalsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="revenueGoal">Meta de Receita (R$)</Label>
                <Input
                  id="revenueGoal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={revenueGoal}
                  onChange={(e) => setRevenueGoal(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="expenseGoal">Meta de Despesas (R$)</Label>
                <Input
                  id="expenseGoal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={expenseGoal}
                  onChange={(e) => setExpenseGoal(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="salesOrdersGoal">Meta de Pedidos de Venda</Label>
                <Input
                  id="salesOrdersGoal"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={salesOrdersGoal}
                  onChange={(e) => setSalesOrdersGoal(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || goalsLoading}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Metas
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Send Email Dialog ─────────────────────────────────────────────────────────

function SendEmailDialog({
  period,
  periodLabel,
  disabled,
}: {
  period: PeriodKey;
  periodLabel: string | undefined;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const { mutate: sendEmail, isPending: isSending } = useSendRelatorioEmail({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "E-mail enviado com sucesso!",
          description: `Relatório enviado para ${data.recipients.join(", ")}`,
        });
        setOpen(false);
        resetForm();
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Não foi possível enviar o e-mail. Verifique as configurações de SMTP.";
        toast({ title: "Erro ao enviar e-mail", description: msg, variant: "destructive" });
      },
    },
  });

  function resetForm() {
    setRecipientInput("");
    setRecipients([]);
    setSubject("");
    setMessage("");
  }

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setSubject(`Relatório Executivo — ${periodLabel ?? "Dashboard"}`);
      setRecipientInput("");
      setRecipients([]);
      setMessage("");
    }
  }

  function addRecipient() {
    const email = recipientInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }
    if (recipients.includes(email)) {
      toast({ title: "E-mail já adicionado", variant: "destructive" });
      return;
    }
    setRecipients((prev) => [...prev, email]);
    setRecipientInput("");
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email));
  }

  function handleRecipientKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addRecipient();
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (recipients.length === 0) {
      toast({ title: "Adicione ao menos um destinatário", variant: "destructive" });
      return;
    }
    sendEmail({ data: { recipients, subject, message: message || undefined, period } });
  }

  const isLoading = isSending;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Mail className="h-4 w-4 mr-2" />
          Enviar por e-mail
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar Relatório por E-mail
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Destinatários</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleRecipientKeyDown}
                onBlur={addRecipient}
              />
              <Button type="button" variant="outline" size="sm" onClick={addRecipient}>
                Adicionar
              </Button>
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipients.map((r) => (
                  <span
                    key={r}
                    className="flex items-center gap-1 text-xs bg-secondary text-secondary-foreground rounded-full px-2.5 py-1"
                  >
                    {r}
                    <button
                      type="button"
                      onClick={() => removeRecipient(r)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {recipients.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Pressione Enter ou vírgula para adicionar cada endereço
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email-subject">Assunto</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email-message">Mensagem (opcional)</Label>
            <Textarea
              id="email-message"
              placeholder="Mensagem personalizada a incluir no e-mail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || recipients.length === 0}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Alert Banner ──────────────────────────────────────────────────────────────

function AlertBanner({ alerts }: { alerts: { kpi: string; label: string; progress: number; daysRemaining: number }[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-800">
            Atenção — metas abaixo de 70% com {alerts[0].daysRemaining} dia{alerts[0].daysRemaining !== 1 ? "s" : ""} restantes no mês
          </p>
          <ul className="mt-1 space-y-0.5">
            {alerts.map((a) => (
              <li key={a.kpi} className="text-sm text-red-700">
                • <strong>{a.label}</strong>: {a.progress.toFixed(1)}% da meta atingida
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
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

function ExecutiveDashboard({ isAdmin }: { isAdmin: boolean }) {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data, isLoading } = useGetExecutiveDashboard({ period });

  const kpis = data?.kpis;
  const trend = data?.monthlyTrend ?? [];
  const topClients = data?.topClients ?? [];
  const topProducts = data?.topProducts ?? [];
  const goals = data?.goals ?? null;
  const alerts = data?.alerts ?? [];

  const revTrend = kpis ? fmtPct(kpis.revenueTotal, kpis.revenueLastPeriod) : null;
  const expTrend = kpis ? fmtPct(kpis.expenseTotal, kpis.expenseLastPeriod) : null;
  const netVal = kpis ? parseFloat(kpis.netBalance) : 0;

  // Compute goal progress percentages (only when goals exist and period is this_month)
  const hasGoals = period === "this_month" && goals != null;

  const revGoalVal = hasGoals ? parseFloat(goals!.revenueGoal) : 0;
  const expGoalVal = hasGoals ? parseFloat(goals!.expenseGoal) : 0;
  const soGoalVal = hasGoals ? goals!.salesOrdersGoal : 0;

  const revProgress = hasGoals && revGoalVal > 0
    ? (parseFloat(kpis?.revenueTotal ?? "0") / revGoalVal) * 100
    : null;
  const expProgress = hasGoals && expGoalVal > 0
    ? (parseFloat(kpis?.expenseTotal ?? "0") / expGoalVal) * 100
    : null;
  const soProgress = hasGoals && soGoalVal > 0
    ? ((kpis?.newSalesOrders ?? 0) / soGoalVal) * 100
    : null;

  const revAlert = alerts.some((a) => a.kpi === "revenue");
  const expAlert = alerts.some((a) => a.kpi === "expense");
  const soAlert = alerts.some((a) => a.kpi === "salesOrders");

  // Current year/month for the goals dialog
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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
      {/* Period selector + Export + Goals buttons */}
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
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <GoalsDialog currentYear={currentYear} currentMonth={currentMonth} />
          )}
          <SendEmailDialog
            period={period}
            periodLabel={data?.periodLabel}
            disabled={isLoading}
          />
          <Button
            variant="outline"
            size="sm"
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Alert banner for goals below 70% near month end */}
          <AlertBanner alerts={alerts} />

          {/* Printable area — captured by html2canvas for PDF export */}
          <div ref={printRef} className="space-y-6 bg-white">

          {/* KPI Cards — financial */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Receita"
              value={kpis?.revenueTotal ?? "0"}
              icon={TrendingUp}
              iconColor="bg-emerald-500"
              trend={revProgress == null ? revTrend : null}
              isCurrency
              goalValue={hasGoals && revGoalVal > 0 ? goals!.revenueGoal : null}
              goalProgress={revProgress}
              isAlert={revAlert}
            />
            <KpiCard
              title="Despesas"
              value={kpis?.expenseTotal ?? "0"}
              icon={TrendingDown}
              iconColor="bg-red-500"
              trend={expProgress == null && expTrend != null ? -expTrend : null}
              isCurrency
              goalValue={hasGoals && expGoalVal > 0 ? goals!.expenseGoal : null}
              goalProgress={expProgress}
              isAlert={expAlert}
            />
            <KpiCard
              title="Saldo Líquido"
              value={kpis?.netBalance ?? "0"}
              icon={DollarSign}
              iconColor={netVal >= 0 ? "bg-blue-500" : "bg-orange-500"}
              isCurrency
            />
            <KpiCard
              title="Novos Pedidos no Período"
              value={kpis?.newSalesOrders ?? 0}
              icon={ShoppingCart}
              iconColor="bg-blue-500"
              href="/vendas"
              goalValue={hasGoals && soGoalVal > 0 ? soGoalVal : null}
              goalProgress={soProgress}
              isAlert={soAlert}
            />
          </div>

          {/* KPI Cards — operations */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard
              title="Pedidos Abertos"
              value={kpis?.openSalesOrders ?? 0}
              icon={ShoppingCart}
              iconColor="bg-blue-400"
              href="/vendas"
            />
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
  const isAdmin = user?.role === "admin";

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={isEmployee ? "Minhas Tarefas" : "Dashboard Gerencial"}
          subtitle={
            isEmployee
              ? "Suas tarefas atribuídas e acesso aos módulos"
              : "Visão executiva consolidada de todos os módulos"
          }
        />

        {isEmployee ? <EmployeeDashboard /> : <ExecutiveDashboard isAdmin={isAdmin} />}
      </div>
    </AppLayout>
  );
}
