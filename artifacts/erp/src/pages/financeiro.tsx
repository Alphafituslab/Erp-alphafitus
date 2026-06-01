import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import {
  useListFinancialEntries,
  useCreateFinancialEntry,
  useUpdateFinancialEntry,
  useDeleteFinancialEntry,
  useMarkFinancialEntryPaid,
  useGetCashflow,
  getListFinancialEntriesQueryKey,
  getGetCashflowQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, CheckCircle2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import type { FinancialEntry } from "@workspace/api-client-react";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  paid: { label: "Pago", variant: "default" },
  overdue: { label: "Vencido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

function fmt(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

const entrySchema = z.object({
  description: z.string().min(1, "Obrigatório"),
  type: z.enum(["income", "expense"]),
  category: z.string().optional(),
  amount: z.string().min(1, "Obrigatório").refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Valor inválido"),
  dueDate: z.string().min(1, "Obrigatório"),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]),
  notes: z.string().optional(),
});

type EntryForm = z.infer<typeof entrySchema>;

interface EntryDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: FinancialEntry | null;
}

function EntryDialog({ open, onClose, editing }: EntryDialogProps) {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListFinancialEntriesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCashflowQueryKey() });
  };

  const createMutation = useCreateFinancialEntry();
  const updateMutation = useUpdateFinancialEntry();

  const form = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    values: editing
      ? {
          description: editing.description,
          type: editing.type,
          category: editing.category ?? "",
          amount: editing.amount,
          dueDate: new Date(editing.dueDate).toISOString().slice(0, 10),
          status: editing.status,
          notes: editing.notes ?? "",
        }
      : { description: "", type: "income", category: "", amount: "", dueDate: "", status: "pending", notes: "" },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      description: data.description,
      type: data.type,
      category: data.category || null,
      amount: data.amount,
      dueDate: new Date(data.dueDate + "T00:00:00").toISOString(),
      status: data.status,
      notes: data.notes || null,
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: payload },
        { onSuccess: () => { invalidateAll(); onClose(); } }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        { onSuccess: () => { invalidateAll(); onClose(); form.reset(); } }
      );
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <Input {...form.register("description")} placeholder="Ex: Fatura de energia" />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo</label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input {...form.register("amount")} placeholder="0,00" />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Vencimento</label>
              <Input type="date" {...form.register("dueDate")} />
              {form.formState.errors.dueDate && (
                <p className="text-xs text-destructive">{form.formState.errors.dueDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Categoria</label>
            <Input {...form.register("category")} placeholder="Ex: Fornecedor, Salário…" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Observações</label>
            <Input {...form.register("notes")} placeholder="Opcional" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FinanceiroPage() {
  const currentYear = new Date().getFullYear();
  const qc = useQueryClient();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinancialEntry | null>(null);

  const queryParams = useMemo(() => ({
    ...(filterType !== "all" ? { type: filterType as "income" | "expense" } : {}),
    ...(filterStatus !== "all" ? { status: filterStatus as "pending" | "paid" | "overdue" | "cancelled" } : {}),
    ...(filterCategory ? { category: filterCategory } : {}),
    ...(filterStart ? { startDate: filterStart } : {}),
    ...(filterEnd ? { endDate: filterEnd } : {}),
  }), [filterType, filterStatus, filterCategory, filterStart, filterEnd]);

  const { data: entries = [], isLoading } = useListFinancialEntries(queryParams);
  const { data: cashflow = [] } = useGetCashflow({ year: currentYear });

  const deleteMutation = useDeleteFinancialEntry();
  const markPaidMutation = useMarkFinancialEntryPaid();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListFinancialEntriesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCashflowQueryKey() });
  };

  const totals = useMemo(() => {
    const receivable = entries
      .filter((e) => e.type === "income" && e.status !== "paid" && e.status !== "cancelled")
      .reduce((s, e) => s + Number(e.amount), 0);
    const payable = entries
      .filter((e) => e.type === "expense" && e.status !== "paid" && e.status !== "cancelled")
      .reduce((s, e) => s + Number(e.amount), 0);
    return { receivable, payable, balance: receivable - payable };
  }, [entries]);

  const chartData = cashflow.map((m) => ({
    name: MONTHS[m.month - 1],
    Receitas: m.income,
    Despesas: m.expense,
  }));

  function openCreate() {
    setEditingEntry(null);
    setDialogOpen(true);
  }

  function openEdit(entry: FinancialEntry) {
    setEditingEntry(entry);
    setDialogOpen(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      { onSuccess: () => { invalidate(); setDeleteTarget(null); } }
    );
  }

  function handleMarkPaid(entry: FinancialEntry) {
    markPaidMutation.mutate(
      { id: entry.id, data: {} },
      { onSuccess: () => invalidate() }
    );
  }

  function rowClass(entry: FinancialEntry) {
    if (entry.status === "paid") return "bg-green-50/50 dark:bg-green-950/10";
    if (entry.status === "overdue") return "bg-red-50/50 dark:bg-red-950/10";
    if (entry.status === "pending") return "bg-yellow-50/50 dark:bg-yellow-950/10";
    return "";
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="text-muted-foreground text-sm mt-1">Contas a pagar e a receber</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-green-600">{fmt(totals.receivable)}</p>
              <p className="text-xs text-muted-foreground mt-1">Em lançamentos pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-red-600">{fmt(totals.payable)}</p>
              <p className="text-xs text-muted-foreground mt-1">Em lançamentos pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Previsto</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${totals.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmt(totals.balance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Receitas − Despesas pendentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Cash Flow Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fluxo de Caixa — {currentYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                />
                <Legend />
                <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="w-40"
            placeholder="Categoria"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          />
          <Input
            type="date"
            className="w-40"
            placeholder="De"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
          />
          <Input
            type="date"
            className="w-40"
            placeholder="Até"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
          />
          {(filterType !== "all" || filterStatus !== "all" || filterCategory || filterStart || filterEnd) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterType("all"); setFilterStatus("all"); setFilterCategory(""); setFilterStart(""); setFilterEnd(""); }}>
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">Carregando…</TableCell>
                  </TableRow>
                )}
                {!isLoading && entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      Nenhum lançamento encontrado
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((entry) => (
                  <TableRow key={entry.id} className={rowClass(entry)}>
                    <TableCell className="font-medium max-w-[200px] truncate">{entry.description}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${entry.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {entry.type === "income" ? "Receita" : "Despesa"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{entry.category || "—"}</TableCell>
                    <TableCell className="text-sm">{fmtDate(entry.dueDate)}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${entry.type === "income" ? "text-green-700" : "text-red-700"}`}>
                      {fmt(entry.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_MAP[entry.status]?.variant ?? "outline"}>
                        {STATUS_MAP[entry.status]?.label ?? entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {entry.status !== "paid" && entry.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700"
                            title="Marcar como pago"
                            onClick={() => handleMarkPaid(entry)}
                            disabled={markPaidMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <EntryDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingEntry(null); }}
        editing={editingEntry}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.description}" será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
