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
  Upload,
  ImageIcon,
  Bell,
  BellOff,
  CheckCircle2,
  FileDown,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  Cell,
  LabelList,
} from "recharts";
import {
  useGetExecutiveDashboard,
  useGetMyTasks,
  useGetDashboardGoals,
  useUpsertDashboardGoals,
  useSendRelatorioEmail,
  useListReportSchedules,
  useCreateReportSchedule,
  useUpdateReportSchedule,
  useDeleteReportSchedule,
  useListReportSendLogs,
  useGetGoalsHistory,
  useGetGoalAlertSettings,
  useUpdateGoalAlertSettings,
} from "@workspace/api-client-react";
import type { ReportSchedule } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

// ── PDF settings (persisted in localStorage) ──────────────────────────────────

const PDF_SETTINGS_KEY = "erp_pdf_settings";

interface PdfSettings {
  companyName: string;
  logoBase64: string | null;
  includeHeader: boolean;
}

function loadPdfSettings(): PdfSettings {
  try {
    const raw = localStorage.getItem(PDF_SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as PdfSettings;
  } catch {}
  return { companyName: "NEXUS ERP", logoBase64: null, includeHeader: true };
}

function savePdfSettings(s: PdfSettings) {
  try {
    localStorage.setItem(PDF_SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

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

const REPORT_SECTIONS = [
  { icon: "💰", label: "Indicadores Financeiros", desc: "Receita, despesas e saldo líquido vs. período anterior" },
  { icon: "📦", label: "Indicadores Operacionais", desc: "Pedidos, estoque baixo, compras pendentes, RH e projetos" },
  { icon: "🏆", label: "Top 5 Clientes", desc: "Maiores clientes por receita no período" },
  { icon: "🔄", label: "Top 5 Produtos", desc: "Produtos com maior movimentação no período" },
];

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
  const [showSections, setShowSections] = useState(false);
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
      setShowSections(false);
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
          {/* Report preview section */}
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Conteúdo do relatório PDF
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/relatorios/export-pdf?period=${period}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline-offset-2 hover:underline flex items-center gap-1"
                >
                  <FileDown className="h-3 w-3" />
                  Baixar prévia
                </a>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSections((v) => !v)}
                >
                  {showSections ? "ocultar ▲" : "ver seções ▼"}
                </button>
              </div>
            </div>
            {showSections && (
              <ul className="space-y-1.5 pt-1">
                {REPORT_SECTIONS.map((s) => (
                  <li key={s.label} className="flex items-start gap-2 text-xs">
                    <span>{s.icon}</span>
                    <div>
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground"> — {s.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

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

// ── PDF Export Dialog ─────────────────────────────────────────────────────────

function PdfExportDialog({
  onExport,
  disabled,
}: {
  onExport: (settings: PdfSettings) => Promise<void>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<PdfSettings>(loadPdfSettings);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettings((prev) => ({
        ...prev,
        logoBase64: (ev.target?.result as string) ?? null,
      }));
    };
    reader.readAsDataURL(file);
  }

  async function handleExport() {
    savePdfSettings(settings);
    setExporting(true);
    try {
      await onExport(settings);
      setOpen(false);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Relatório em PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-3 rounded-md border p-3">
            <Checkbox
              id="include-header"
              checked={settings.includeHeader}
              onCheckedChange={(v) =>
                setSettings((prev) => ({ ...prev, includeHeader: !!v }))
              }
            />
            <Label htmlFor="include-header" className="cursor-pointer leading-snug">
              Incluir cabeçalho com logo e rodapé com numeração de páginas
            </Label>
          </div>

          {settings.includeHeader && (
            <>
              <div className="space-y-1">
                <Label htmlFor="pdf-company-name">Nome da empresa</Label>
                <Input
                  id="pdf-company-name"
                  value={settings.companyName}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, companyName: e.target.value }))
                  }
                  placeholder="Ex: Empresa Ltda."
                />
              </div>

              <div className="space-y-2">
                <Label>Logo da empresa</Label>
                <div className="flex items-center gap-3">
                  {settings.logoBase64 ? (
                    <img
                      src={settings.logoBase64}
                      alt="Logo"
                      className="h-10 w-auto max-w-[80px] object-contain border rounded p-0.5"
                    />
                  ) : (
                    <div className="h-10 w-10 border rounded flex items-center justify-center bg-muted">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {settings.logoBase64 ? "Trocar logo" : "Carregar logo"}
                  </Button>
                  {settings.logoBase64 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, logoBase64: null }))
                      }
                    >
                      Remover
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG ou JPG recomendado. A logo é salva no navegador.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={exporting}
            >
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Gerando PDF…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </>
              )}
            </Button>
          </div>
        </div>
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

// ── Schedule Dialog ───────────────────────────────────────────────────────────

const DAY_OF_WEEK_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const PERIOD_OPTIONS = [
  { value: "last_month", label: "Mês anterior" },
  { value: "this_month", label: "Este mês" },
  { value: "this_quarter", label: "Este trimestre" },
  { value: "this_year", label: "Este ano" },
];

function ScheduleDialog({
  schedule,
  onClose,
}: {
  schedule: ReportSchedule | null;
  onClose: () => void;
}) {
  const isEdit = schedule !== null;
  const [frequency, setFrequency] = useState<"weekly" | "monthly">(schedule?.frequency as "weekly" | "monthly" ?? "monthly");
  const [dayOfWeek, setDayOfWeek] = useState(String(schedule?.dayOfWeek ?? 1));
  const [dayOfMonth, setDayOfMonth] = useState(String(schedule?.dayOfMonth ?? 1));
  const [hour, setHour] = useState(String(schedule?.hour ?? 8));
  const [minute, setMinute] = useState(String(schedule?.minute ?? 0));
  const [period, setPeriod] = useState(schedule?.period ?? "last_month");
  const [recipients, setRecipients] = useState(schedule?.recipients ?? "");
  const [subject, setSubject] = useState(schedule?.subject ?? "Relatório Executivo — NEXUS ERP");
  const [message, setMessage] = useState(schedule?.message ?? "");
  const [active, setActive] = useState(schedule?.active ?? true);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/relatorios/schedules"] });
  };

  const { mutate: createSchedule, isPending: isCreating } = useCreateReportSchedule({
    mutation: {
      onSuccess: () => { toast({ title: "Agendamento criado!" }); invalidate(); onClose(); },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao criar agendamento";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const { mutate: updateSchedule, isPending: isUpdating } = useUpdateReportSchedule({
    mutation: {
      onSuccess: () => { toast({ title: "Agendamento atualizado!" }); invalidate(); onClose(); },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao atualizar agendamento";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      frequency,
      dayOfWeek: frequency === "weekly" ? parseInt(dayOfWeek) : undefined,
      dayOfMonth: frequency === "monthly" ? parseInt(dayOfMonth) : undefined,
      hour: parseInt(hour),
      minute: parseInt(minute),
      period,
      recipients: recipients.trim(),
      subject: subject.trim(),
      message: message.trim() || undefined,
      active,
    };
    if (isEdit) {
      updateSchedule({ id: schedule!.id, data: payload });
    } else {
      createSchedule({ data: payload });
    }
  }

  const isPending = isCreating || isUpdating;

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Frequência</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as "weekly" | "monthly")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {frequency === "weekly" ? (
            <div className="space-y-1">
              <Label>Dia da semana</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_LABELS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Dia do mês</Label>
              <Input
                type="number" min="1" max="28"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Hora (0–23)</Label>
            <Input type="number" min="0" max="23" value={hour} onChange={(e) => setHour(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Minuto (0–59)</Label>
            <Input type="number" min="0" max="59" value={minute} onChange={(e) => setMinute(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Período do relatório</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Destinatários</Label>
          <Input
            placeholder="email1@empresa.com, email2@empresa.com"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Separe múltiplos e-mails com vírgula</p>
        </div>

        <div className="space-y-1">
          <Label>Assunto</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>

        <div className="space-y-1">
          <Label>Mensagem (opcional)</Label>
          <Textarea
            placeholder="Mensagem personalizada..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active-check"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="active-check" className="cursor-pointer">Agendamento ativo</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

// ── Schedule Management Section ────────────────────────────────────────────────

function ScheduleSection({ isAdmin }: { isAdmin: boolean }) {
  const [editTarget, setEditTarget] = useState<ReportSchedule | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ReportSchedule | null>(null);

  const { data: schedules, isLoading } = useListReportSchedules();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: deleteSchedule, isPending: isDeleting } = useDeleteReportSchedule({
    mutation: {
      onSuccess: () => {
        toast({ title: "Agendamento removido" });
        queryClient.invalidateQueries({ queryKey: ["/api/relatorios/schedules"] });
        setDeleteTarget(null);
      },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    },
  });

  function describeSchedule(s: ReportSchedule): string {
    if (s.frequency === "weekly") {
      return `Toda ${DAY_OF_WEEK_LABELS[s.dayOfWeek ?? 1]} às ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
    }
    return `Todo dia ${s.dayOfMonth ?? 1} às ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
  }

  const periodLabel = (p: string) => PERIOD_OPTIONS.find((o) => o.value === p)?.label ?? p;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Agendamentos de Envio</CardTitle>
          {isAdmin && (
            <Dialog open={editTarget === null} onOpenChange={(o) => { if (!o) setEditTarget(undefined); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditTarget(null)}>
                  + Novo agendamento
                </Button>
              </DialogTrigger>
              {editTarget === null && (
                <ScheduleDialog schedule={null} onClose={() => setEditTarget(undefined)} />
              )}
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (schedules?.length ?? 0) === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              {isAdmin ? "Nenhum agendamento configurado. Clique em \"+ Novo agendamento\" para criar." : "Nenhum agendamento configurado."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recorrência</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Destinatários</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm font-medium">{describeSchedule(s)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{periodLabel(s.period)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{s.recipients}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {s.active ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Dialog open={editTarget?.id === s.id} onOpenChange={(o) => { if (!o) setEditTarget(undefined); }}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setEditTarget(s)}>Editar</Button>
                            </DialogTrigger>
                            {editTarget?.id === s.id && (
                              <ScheduleDialog schedule={s} onClose={() => setEditTarget(undefined)} />
                            )}
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(s)}
                          >
                            Remover
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover agendamento?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            Esta ação não pode ser desfeita. O histórico de envios será mantido.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => deleteTarget && deleteSchedule({ id: deleteTarget.id })}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Send History Section ───────────────────────────────────────────────────────

function SendHistory() {
  const { data: logs, isLoading } = useListReportSendLogs({ limit: 30 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de Envios</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (logs?.length ?? 0) === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">Nenhum envio registrado ainda</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(log.sentAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.periodLabel}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.triggerType === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                      {log.triggerType === "scheduled" ? "Automático" : "Manual"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{log.recipients}</TableCell>
                  <TableCell>
                    {log.status === "success" ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Enviado</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700" title={log.errorMessage ?? ""}>Erro</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Goal Alert Settings Section ───────────────────────────────────────────────

function GoalAlertSettingsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: settings, isLoading } = useGetGoalAlertSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [notifyHour, setNotifyHour] = useState<string>("");
  const [notifyMinute, setNotifyMinute] = useState<string>("");
  const [progressThreshold, setProgressThreshold] = useState<string>("");
  const [daysRemainingThreshold, setDaysRemainingThreshold] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setNotifyHour(String(settings.notifyHour));
      setNotifyMinute(String(settings.notifyMinute));
      setProgressThreshold(String(settings.progressThreshold));
      setDaysRemainingThreshold(String(settings.daysRemainingThreshold));
      setDirty(false);
    }
  }, [settings]);

  const { mutate: updateSettings, isPending: isSaving } = useUpdateGoalAlertSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Configurações de alerta salvas" });
        queryClient.invalidateQueries({ queryKey: ["/api/relatorios/goal-alerts/settings"] });
        setDirty(false);
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Erro ao salvar";
        toast({ title: message, variant: "destructive" });
      },
    },
  });

  function handleSave() {
    updateSettings({
      data: {
        enabled: enabled ?? true,
        notifyHour: parseInt(notifyHour, 10),
        notifyMinute: parseInt(notifyMinute, 10),
        progressThreshold: parseInt(progressThreshold, 10),
        daysRemainingThreshold: parseInt(daysRemainingThreshold, 10),
      },
    });
  }

  function markDirty() {
    setDirty(true);
  }

  const isOn = enabled ?? settings?.enabled ?? true;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          {isOn ? (
            <Bell className="h-4 w-4 text-amber-500" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          <CardTitle className="text-base">Alertas de Metas por E-mail</CardTitle>
        </div>
        {settings?.lastSentDate && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            Último envio: {settings.lastSentDate}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Quando uma meta do mês cair abaixo do limiar configurado e restarem poucos dias, todos os administradores e gestores recebem um e-mail de alerta automaticamente.
            </p>

            {/* Enable / Disable toggle */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="goal-alert-enabled"
                checked={isOn}
                disabled={!isAdmin}
                onCheckedChange={(checked) => {
                  setEnabled(checked === true);
                  markDirty();
                }}
              />
              <Label htmlFor="goal-alert-enabled" className={!isAdmin ? "text-muted-foreground" : ""}>
                {isOn ? "Notificações ativadas" : "Notificações desativadas"}
              </Label>
              {!isOn && (
                <span className="ml-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Inativo</span>
              )}
              {isOn && (
                <span className="ml-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Ativo</span>
              )}
            </div>

            {/* Config grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hora do envio</Label>
                <Select
                  value={notifyHour}
                  onValueChange={(v) => { setNotifyHour(v); markDirty(); }}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Hora" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String(i).padStart(2, "0")}h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Minuto</Label>
                <Select
                  value={notifyMinute}
                  onValueChange={(v) => { setNotifyMinute(v); markDirty(); }}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Minuto" />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 15, 30, 45].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {String(m).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Limiar de progresso (%)</Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={progressThreshold}
                  disabled={!isAdmin}
                  className="h-8 text-sm"
                  onChange={(e) => { setProgressThreshold(e.target.value); markDirty(); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dias restantes ≤</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={daysRemainingThreshold}
                  disabled={!isAdmin}
                  className="h-8 text-sm"
                  onChange={(e) => { setDaysRemainingThreshold(e.target.value); markDirty(); }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              O alerta é disparado uma vez por dia, na hora configurada, se a meta estiver abaixo de {progressThreshold || settings?.progressThreshold}% e restar até {daysRemainingThreshold || settings?.daysRemainingThreshold} dias no mês. Os destinatários são todos os admins e gestores cadastrados.
            </p>

            {!isAdmin && (
              <p className="text-xs text-amber-600 font-medium">Apenas administradores podem alterar estas configurações.</p>
            )}

            {isAdmin && dirty && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar configurações
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Goals History Section ─────────────────────────────────────────────────────

type GoalsMetric = "revenue" | "expense" | "salesOrders";

const GOALS_METRIC_OPTIONS: { value: GoalsMetric; label: string; isCurrency: boolean }[] = [
  { value: "revenue", label: "Receita", isCurrency: true },
  { value: "expense", label: "Despesas", isCurrency: true },
  { value: "salesOrders", label: "Pedidos de Venda", isCurrency: false },
];

function achievementColor(pct: number): string {
  if (pct >= 100) return "#10b981"; // emerald-500
  if (pct >= 70) return "#f59e0b"; // amber-400
  return "#ef4444"; // red-500
}

function GoalsHistorySection() {
  const [metric, setMetric] = useState<GoalsMetric>("revenue");
  const { data: history, isLoading } = useGetGoalsHistory({ months: 12 });

  const metricCfg = GOALS_METRIC_OPTIONS.find((o) => o.value === metric)!;

  const chartData = (history ?? []).map((item) => {
    let actual: number;
    let goal: number;

    if (metric === "revenue") {
      actual = parseFloat(item.revenueActual);
      goal = parseFloat(item.revenueGoal);
    } else if (metric === "expense") {
      actual = parseFloat(item.expenseActual);
      goal = parseFloat(item.expenseGoal);
    } else {
      actual = item.salesOrdersActual;
      goal = item.salesOrdersGoal;
    }

    const pct = goal > 0 ? Math.round((actual / goal) * 1000) / 10 : null;

    return {
      monthLabel: item.monthLabel,
      actual,
      goal,
      pct,
      hasGoal: item.hasGoal,
    };
  });

  const fmtVal = (v: number) =>
    metricCfg.isCurrency
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
      : String(v);

  const metMonths = chartData.filter((d) => d.pct != null && d.pct >= 100).length;
  const totalWithGoal = chartData.filter((d) => d.hasGoal).length;
  const avgPct =
    totalWithGoal > 0
      ? Math.round(
          chartData.filter((d) => d.pct != null).reduce((s, d) => s + (d.pct ?? 0), 0) /
            totalWithGoal
        )
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Histórico de Metas — Real vs. Planejado (12 meses)
          </CardTitle>
          <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/30 self-start sm:self-auto">
            {GOALS_METRIC_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setMetric(o.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  metric === o.value
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary pills */}
        {!isLoading && totalWithGoal > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              ✓ {metMonths}/{totalWithGoal} meses atingidos
            </span>
            {avgPct != null && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  avgPct >= 100
                    ? "bg-emerald-100 text-emerald-700"
                    : avgPct >= 70
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                Média: {avgPct}%
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : totalWithGoal === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-8 w-8 text-muted-foreground mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhuma meta configurada nos últimos 12 meses.</p>
            <p className="text-xs text-muted-foreground mt-1">Configure metas mensais clicando em "Configurar Metas".</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 6)}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) =>
                  metricCfg.isCurrency
                    ? v >= 1000
                      ? `R$${(v / 1000).toFixed(0)}k`
                      : `R$${v}`
                    : String(v)
                }
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0]?.payload as (typeof chartData)[0];
                  return (
                    <div className="rounded-lg border bg-white shadow-md p-3 text-xs space-y-1 min-w-[160px]">
                      <p className="font-semibold text-sm mb-2">{label}</p>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Real:</span>
                        <span className="font-medium">{fmtVal(d.actual)}</span>
                      </div>
                      {d.hasGoal && (
                        <>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Meta:</span>
                            <span className="font-medium">{fmtVal(d.goal)}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 border-t mt-1">
                            <span className="text-muted-foreground">Cumprimento:</span>
                            <span
                              className="font-bold"
                              style={{ color: d.pct != null ? achievementColor(d.pct) : undefined }}
                            >
                              {d.pct != null ? `${d.pct.toFixed(1)}%` : "—"}
                            </span>
                          </div>
                        </>
                      )}
                      {!d.hasGoal && (
                        <p className="text-muted-foreground italic">Sem meta definida</p>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(v: string) =>
                  v === "actual" ? metricCfg.label + " (Real)" : "Meta"
                }
              />
              <Bar dataKey="actual" name="actual" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      !entry.hasGoal
                        ? "#94a3b8"
                        : entry.pct != null
                        ? achievementColor(entry.pct)
                        : "#94a3b8"
                    }
                  />
                ))}
                <LabelList
                  dataKey="pct"
                  position="top"
                  content={(props) => {
                    const { x, y, width, value } = props as {
                      x?: number; y?: number; width?: number; value?: number | null;
                    };
                    if (x == null || y == null || width == null || value == null) return null;
                    const label = `${value.toFixed(0)}%`;
                    const cx = x + width / 2;
                    const cy = (y as number) - 4;
                    return (
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill={achievementColor(value)}
                      >
                        {label}
                      </text>
                    );
                  }}
                />
              </Bar>
              <Bar dataKey="goal" name="goal" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={40} opacity={0.6} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {/* Achievement % table */}
        {!isLoading && totalWithGoal > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Mês</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Real</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Meta</th>
                  <th className="text-right py-1.5 pl-2 text-muted-foreground font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-1.5 pr-3 font-medium">{row.monthLabel}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{fmtVal(row.actual)}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">
                      {row.hasGoal ? fmtVal(row.goal) : <span className="italic">—</span>}
                    </td>
                    <td className="text-right py-1.5 pl-2 font-semibold tabular-nums">
                      {row.pct != null ? (
                        <span style={{ color: achievementColor(row.pct) }}>{row.pct.toFixed(1)}%</span>
                      ) : (
                        <span className="text-muted-foreground italic text-[10px]">sem meta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
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

function ExecutiveDashboard({ isAdmin, isManager }: { isAdmin: boolean; isManager: boolean }) {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
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

  async function handleExportPdf(pdfSettings: PdfSettings) {
    if (!printRef.current || isLoading) return;
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

      const HEADER_H = pdfSettings.includeHeader ? 20 : 0;
      const FOOTER_H = pdfSettings.includeHeader ? 10 : 0;
      const availableH = pageH - margin * 2 - HEADER_H - FOOTER_H;

      const imgH = (elH * contentW) / elW;
      const totalPages = Math.max(1, Math.ceil(imgH / availableH));

      const generatedAt = new Date().toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      const periodLabelText = data?.periodLabel ?? PERIOD_LABELS[period];

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        // ── Content image (place first, then cover non-content zones) ──────────
        const imgY = margin + HEADER_H - page * availableH;
        pdf.addImage(imgData, "PNG", margin, imgY, contentW, imgH);

        if (pdfSettings.includeHeader) {
          // ── Header overlay (white background + content) ────────────────────
          pdf.setFillColor(248, 250, 252);
          pdf.rect(0, 0, pageW, HEADER_H, "F");

          // Bottom border of header
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.3);
          pdf.line(0, HEADER_H, pageW, HEADER_H);

          let xCursor = margin;

          // Logo (if provided)
          if (pdfSettings.logoBase64) {
            try {
              const isJpeg =
                pdfSettings.logoBase64.startsWith("data:image/jpeg") ||
                pdfSettings.logoBase64.startsWith("data:image/jpg");
              const fmt = isJpeg ? "JPEG" : "PNG";
              const logoSize = 13;
              const logoY = (HEADER_H - logoSize) / 2;
              pdf.addImage(pdfSettings.logoBase64, fmt, xCursor, logoY, logoSize, logoSize);
              xCursor += logoSize + 3;
            } catch {
              // Skip logo if it can't be added
            }
          }

          // Company name (bold)
          pdf.setFontSize(13);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(30, 41, 59);
          pdf.text(pdfSettings.companyName || "NEXUS ERP", xCursor, HEADER_H / 2 - 1);

          // Subtitle: report label + period
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 116, 139);
          pdf.text(
            `Relatório Executivo — ${periodLabelText}`,
            xCursor,
            HEADER_H / 2 + 4.5,
          );

          // Generated date (top-right)
          pdf.setFontSize(7);
          pdf.setTextColor(148, 163, 184);
          const dateText = `Gerado em ${generatedAt}`;
          const dateW = pdf.getTextWidth(dateText);
          pdf.text(dateText, pageW - margin - dateW, HEADER_H / 2 - 1);

          // ── Footer overlay ─────────────────────────────────────────────────
          const footerY = pageH - FOOTER_H;
          pdf.setFillColor(248, 250, 252);
          pdf.rect(0, footerY, pageW, FOOTER_H, "F");

          // Top border of footer
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.3);
          pdf.line(0, footerY, pageW, footerY);

          const footerTextY = footerY + FOOTER_H / 2 + 1.5;

          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(148, 163, 184);
          pdf.text("Documento confidencial — uso interno", margin, footerTextY);

          const pageText = `Página ${page + 1} de ${totalPages}`;
          const pageTextW = pdf.getTextWidth(pageText);
          pdf.text(pageText, pageW - margin - pageTextW, footerTextY);

          // ── White strips to clip content bleeding into header/footer margins ──
          // Left/right margins
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, HEADER_H, margin, pageH - HEADER_H - FOOTER_H, "F");
          pdf.rect(pageW - margin, HEADER_H, margin, pageH - HEADER_H - FOOTER_H, "F");
        } else {
          // No header: still clip left/right margins
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, margin, pageH, "F");
          pdf.rect(pageW - margin, 0, margin, pageH, "F");
        }
      }

      const periodSlug = (data?.periodLabel ?? period)
        .toLowerCase()
        .replace(/\//g, "-")
        .replace(/\s+/g, "-");
      pdf.save(`relatorio-executivo-${periodSlug}.pdf`);
    } catch {
      toast({
        title: "Erro ao exportar PDF",
        description: "Não foi possível gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
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
          {(isAdmin || isManager) && (
            <GoalsDialog currentYear={currentYear} currentMonth={currentMonth} />
          )}
          <SendEmailDialog
            period={period}
            periodLabel={data?.periodLabel}
            disabled={isLoading}
          />
          <PdfExportDialog
            onExport={handleExportPdf}
            disabled={isLoading}
          />
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

          {/* Goals History — real vs planned */}
          <GoalsHistorySection />

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

          {/* Goal alert settings */}
          <GoalAlertSettingsSection isAdmin={isAdmin} />

          {/* Schedule management + send history */}
          <ScheduleSection isAdmin={isAdmin} />
          <SendHistory />
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
  const isManager = user?.role === "manager";

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

        {isEmployee ? <EmployeeDashboard /> : <ExecutiveDashboard isAdmin={isAdmin} isManager={isManager} />}
      </div>
    </AppLayout>
  );
}
