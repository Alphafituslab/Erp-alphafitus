import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListQualityInspections,
  useCreateQualityInspection,
  useUpdateQualityInspection,
  useDeleteQualityInspection,
  useListQualityNcrs,
  useCreateQualityNcr,
  useUpdateQualityNcr,
  useDeleteQualityNcr,
  useResolveQualityNcr,
  useGetQualidadeDashboard,
  useListProducts,
  getListQualityInspectionsQueryKey,
  getListQualityNcrsQueryKey,
  getGetQualidadeDashboardQueryKey,
} from "@workspace/api-client-react";
import type { QualityInspection, QualityNcr } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus, Pencil, Trash2, ClipboardCheck, ShieldAlert, ThumbsUp,
  AlertTriangle, CheckCheck,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}


// ─── Inspection Dialog ────────────────────────────────────────────────────────

const inspectionSchema = z.object({
  productId: z.string().optional(),
  batchNumber: z.string().optional(),
  inspectionDate: z.string().min(1, "Obrigatório"),
  inspector: z.string().min(1, "Obrigatório"),
  result: z.enum(["approved", "rejected", "conditional"]),
  quantityInspected: z.string().optional(),
  quantityFailed: z.string().optional(),
  notes: z.string().optional(),
});
type InspectionForm = z.infer<typeof inspectionSchema>;

function InspectionDialog({
  open, onClose, editing, products,
}: {
  open: boolean;
  onClose: () => void;
  editing?: QualityInspection | null;
  products: Array<{ id: number; name: string; sku?: string | null }>;
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListQualityInspectionsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
  };
  const createM = useCreateQualityInspection();
  const updateM = useUpdateQualityInspection();

  const form = useForm<InspectionForm>({
    resolver: zodResolver(inspectionSchema),
    values: editing
      ? {
          productId: editing.productId ? String(editing.productId) : "",
          batchNumber: editing.batchNumber ?? "",
          inspectionDate: editing.inspectionDate,
          inspector: editing.inspector,
          result: editing.result as "approved" | "rejected" | "conditional",
          quantityInspected: String(editing.quantityInspected),
          quantityFailed: String(editing.quantityFailed),
          notes: editing.notes ?? "",
        }
      : { productId: "", batchNumber: "", inspectionDate: todayStr(), inspector: "", result: "approved", quantityInspected: "0", quantityFailed: "0", notes: "" },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      productId: data.productId ? parseInt(data.productId) : null,
      batchNumber: data.batchNumber || null,
      inspectionDate: data.inspectionDate,
      inspector: data.inspector,
      result: data.result,
      quantityInspected: data.quantityInspected ? parseInt(data.quantityInspected) : 0,
      quantityFailed: data.quantityFailed ? parseInt(data.quantityFailed) : 0,
      notes: data.notes || null,
    };
    if (editing) {
      updateM.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createM.mutate({ data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Inspeção" : "Nova Inspeção"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Produto</label>
              <Controller control={form.control} name="productId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Nenhum —</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}{p.sku ? ` (${p.sku})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Lote / Referência</label>
              <Input {...form.register("batchNumber")} placeholder="Ex: LOTE-2025-01" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Data da inspeção *</label>
              <Input {...form.register("inspectionDate")} type="date" />
              {form.formState.errors.inspectionDate && (
                <p className="text-xs text-destructive">{form.formState.errors.inspectionDate.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Inspetor *</label>
              <Input {...form.register("inspector")} placeholder="Nome do inspetor" />
              {form.formState.errors.inspector && (
                <p className="text-xs text-destructive">{form.formState.errors.inspector.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Resultado *</label>
            <Controller control={form.control} name="result" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">✅ Aprovado</SelectItem>
                  <SelectItem value="conditional">⚠️ Condicional</SelectItem>
                  <SelectItem value="rejected">❌ Reprovado</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Qtd. inspecionada</label>
              <Input {...form.register("quantityInspected")} type="number" min="0" step="1" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Qtd. com defeito</label>
              <Input {...form.register("quantityFailed")} type="number" min="0" step="1" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Observações</label>
            <Input {...form.register("notes")} placeholder="Opcional" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── NCR Dialog ───────────────────────────────────────────────────────────────

const ncrSchema = z.object({
  inspectionId: z.string().optional(),
  productId: z.string().optional(),
  title: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  reportedBy: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
});
type NcrForm = z.infer<typeof ncrSchema>;

function NcrDialog({
  open, onClose, editing, products, inspections,
}: {
  open: boolean;
  onClose: () => void;
  editing?: QualityNcr | null;
  products: Array<{ id: number; name: string }>;
  inspections: QualityInspection[];
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListQualityNcrsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
  };
  const createM = useCreateQualityNcr();
  const updateM = useUpdateQualityNcr();

  const form = useForm<NcrForm>({
    resolver: zodResolver(ncrSchema),
    values: editing
      ? {
          inspectionId: editing.inspectionId ? String(editing.inspectionId) : "",
          productId: editing.productId ? String(editing.productId) : "",
          title: editing.title,
          description: editing.description ?? "",
          severity: editing.severity as NcrForm["severity"],
          status: editing.status as NcrForm["status"],
          rootCause: editing.rootCause ?? "",
          correctiveAction: editing.correctiveAction ?? "",
          reportedBy: editing.reportedBy ?? "",
          assignedTo: editing.assignedTo ?? "",
          dueDate: editing.dueDate ?? "",
        }
      : { inspectionId: "", productId: "", title: "", description: "", severity: "medium", status: "open", rootCause: "", correctiveAction: "", reportedBy: "", assignedTo: "", dueDate: "" },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      inspectionId: data.inspectionId ? parseInt(data.inspectionId) : null,
      productId: data.productId ? parseInt(data.productId) : null,
      title: data.title,
      description: data.description || null,
      severity: data.severity,
      status: data.status,
      rootCause: data.rootCause || null,
      correctiveAction: data.correctiveAction || null,
      reportedBy: data.reportedBy || null,
      assignedTo: data.assignedTo || null,
      dueDate: data.dueDate || null,
    };
    if (editing) {
      updateM.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createM.mutate({ data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar NCR" : "Nova Não Conformidade"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Título *</label>
            <Input {...form.register("title")} placeholder="Descrição curta do problema" />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Produto</label>
              <Controller control={form.control} name="productId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Nenhum —</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Inspeção relacionada</label>
              <Controller control={form.control} name="inspectionId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Nenhuma —</SelectItem>
                    {inspections.slice(0, 20).map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>
                        #{i.id} — {i.inspectionDate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Severidade</label>
              <Controller control={form.control} name="severity" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🔵 Baixa</SelectItem>
                    <SelectItem value="medium">🟡 Média</SelectItem>
                    <SelectItem value="high">🟠 Alta</SelectItem>
                    <SelectItem value="critical">🔴 Crítica</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Controller control={form.control} name="status" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="resolved">Resolvida</SelectItem>
                    <SelectItem value="closed">Fechada</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <Input {...form.register("description")} placeholder="Detalhe do problema" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Causa raiz</label>
            <Input {...form.register("rootCause")} placeholder="Por que ocorreu?" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Ação corretiva</label>
            <Input {...form.register("correctiveAction")} placeholder="O que será feito?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Reportado por</label>
              <Input {...form.register("reportedBy")} placeholder="Nome" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Responsável</label>
              <Input {...form.register("assignedTo")} placeholder="Nome" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Prazo</label>
            <Input {...form.register("dueDate")} type="date" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QualidadePage() {
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("dashboard");

  // Inspection state
  const [inspSearch, setInspSearch] = useState("");
  const [inspResultFilter, setInspResultFilter] = useState("all");
  const [inspDialog, setInspDialog] = useState(false);
  const [editingInsp, setEditingInsp] = useState<QualityInspection | null>(null);
  const [deleteInsp, setDeleteInsp] = useState<QualityInspection | null>(null);

  // NCR state
  const [ncrSearch, setNcrSearch] = useState("");
  const [ncrStatusFilter, setNcrStatusFilter] = useState("all");
  const [ncrSeverityFilter, setNcrSeverityFilter] = useState("all");
  const [ncrDialog, setNcrDialog] = useState(false);
  const [editingNcr, setEditingNcr] = useState<QualityNcr | null>(null);
  const [deleteNcr, setDeleteNcr] = useState<QualityNcr | null>(null);
  const [resolveNcr, setResolveNcr] = useState<QualityNcr | null>(null);

  const { data: inspections = [], isLoading: inspLoading } = useListQualityInspections({});
  const { data: ncrs = [], isLoading: ncrsLoading } = useListQualityNcrs({});
  const { data: dashboard } = useGetQualidadeDashboard();
  const { data: products = [] } = useListProducts({});

  const deleteInspMutation = useDeleteQualityInspection();
  const deleteNcrMutation = useDeleteQualityNcr();
  const resolveNcrMutation = useResolveQualityNcr();

  const activeProducts = useMemo(() => products.filter((p) => p.active === "true"), [products]);

  const filteredInspections = useMemo(() => {
    let list = inspections;
    if (inspResultFilter !== "all") list = list.filter((i) => i.result === inspResultFilter);
    if (inspSearch) {
      const q = inspSearch.toLowerCase();
      list = list.filter(
        (i) =>
          (i.productName ?? "").toLowerCase().includes(q) ||
          (i.inspector ?? "").toLowerCase().includes(q) ||
          (i.batchNumber ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [inspections, inspResultFilter, inspSearch]);

  const filteredNcrs = useMemo(() => {
    let list = ncrs;
    if (ncrStatusFilter !== "all") list = list.filter((n) => n.status === ncrStatusFilter);
    if (ncrSeverityFilter !== "all") list = list.filter((n) => n.severity === ncrSeverityFilter);
    if (ncrSearch) {
      const q = ncrSearch.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.productName ?? "").toLowerCase().includes(q) ||
          (n.reportedBy ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [ncrs, ncrStatusFilter, ncrSeverityFilter, ncrSearch]);

  const approvalRate = dashboard?.approvalRate ?? 0;

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Controle de Qualidade"
          subtitle="Inspeções, não conformidades e indicadores de qualidade"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="inspections">Inspeções</TabsTrigger>
            <TabsTrigger value="ncrs">Não Conformidades</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total de inspeções</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{dashboard?.totalInspections ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Registradas no sistema</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de aprovação</CardTitle>
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${approvalRate >= 90 ? "text-green-600" : approvalRate >= 70 ? "text-yellow-600" : "text-destructive"}`}>
                    {approvalRate}%
                  </p>
                  <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                    <span>{dashboard?.approvedCount ?? 0} aprovadas</span>
                    <span>·</span>
                    <span>{dashboard?.rejectedCount ?? 0} reprovadas</span>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={(dashboard?.openNcrsCount ?? 0) > 0 ? "cursor-pointer hover:border-red-400 transition-colors" : ""}
                onClick={() => (dashboard?.openNcrsCount ?? 0) > 0 && setActiveTab("ncrs")}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">NCRs abertas</CardTitle>
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${(dashboard?.openNcrsCount ?? 0) > 0 ? "text-destructive" : ""}`}>
                    {dashboard?.openNcrsCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(dashboard?.openNcrsCount ?? 0) > 0 ? "Clique para ver" : "Nenhuma pendente"}
                  </p>
                </CardContent>
              </Card>

              <Card
                className={(dashboard?.criticalNcrsCount ?? 0) > 0 ? "cursor-pointer hover:border-red-600 transition-colors" : ""}
                onClick={() => {
                  if ((dashboard?.criticalNcrsCount ?? 0) > 0) {
                    setNcrSeverityFilter("critical");
                    setNcrStatusFilter("all");
                    setActiveTab("ncrs");
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">NCRs críticas ativas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${(dashboard?.criticalNcrsCount ?? 0) > 0 ? "text-red-600" : ""}`}>
                    {dashboard?.criticalNcrsCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(dashboard?.criticalNcrsCount ?? 0) > 0 ? "Atenção imediata necessária" : "Nenhuma crítica"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recent inspections */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Inspeções recentes</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => { setEditingInsp(null); setInspDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nova
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {(dashboard?.recentInspections ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">Nenhuma inspeção registrada</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Produto / Lote</TableHead>
                          <TableHead>Inspetor</TableHead>
                          <TableHead>Resultado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dashboard?.recentInspections ?? []).map((i) => (
                          <TableRow key={i.id}>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(i.inspectionDate)}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{i.productName ?? "—"}</div>
                              {i.batchNumber && <div className="text-xs text-muted-foreground">{i.batchNumber}</div>}
                            </TableCell>
                            <TableCell className="text-sm">{i.inspector}</TableCell>
                            <TableCell><StatusBadge status={i.result} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Open NCRs */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">NCRs em aberto</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => { setEditingNcr(null); setNcrDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nova NCR
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {(dashboard?.openNcrList ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground px-2 pb-2">Nenhuma NCR em aberto ✓</p>
                  )}
                  {(dashboard?.openNcrList ?? []).map((ncr) => (
                    <div key={ncr.id} className="flex items-start justify-between gap-3 border rounded-lg p-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ncr.title}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={ncr.severity} />
                          <StatusBadge status={ncr.status} />
                          {ncr.productName && (
                            <span className="text-xs text-muted-foreground">{ncr.productName}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {ncr.dueDate && (
                          <p className="text-xs text-muted-foreground">Prazo: {fmtDate(ncr.dueDate)}</p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 mt-1 text-green-700"
                          onClick={() => setResolveNcr(ncr)}
                        >
                          <CheckCheck className="h-3.5 w-3.5 mr-1" /> Resolver
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── INSPECTIONS TAB ───────────────────────────────────────────── */}
          <TabsContent value="inspections" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <Input
                  className="w-52"
                  placeholder="Buscar produto, inspetor, lote…"
                  value={inspSearch}
                  onChange={(e) => setInspSearch(e.target.value)}
                />
                <Select value={inspResultFilter} onValueChange={setInspResultFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os resultados</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="conditional">Condicional</SelectItem>
                    <SelectItem value="rejected">Reprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { setEditingInsp(null); setInspDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nova inspeção
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto / Lote</TableHead>
                      <TableHead>Inspetor</TableHead>
                      <TableHead className="text-right">Insp.</TableHead>
                      <TableHead className="text-right">Defeitos</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspLoading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!inspLoading && filteredInspections.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhuma inspeção encontrada</TableCell></TableRow>
                    )}
                    {filteredInspections.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(i.inspectionDate)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{i.productName ?? "—"}</div>
                          {i.batchNumber && <div className="text-xs text-muted-foreground font-mono">{i.batchNumber}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{i.inspector}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{i.quantityInspected}</TableCell>
                        <TableCell className={`text-right text-sm tabular-nums font-medium ${i.quantityFailed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {i.quantityFailed}
                        </TableCell>
                        <TableCell><StatusBadge status={i.result} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{i.notes ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => { setEditingInsp(i); setInspDialog(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteInsp(i)}>
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
          </TabsContent>

          {/* ── NCRs TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="ncrs" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3 flex-wrap">
                <Input
                  className="w-52"
                  placeholder="Buscar título, produto…"
                  value={ncrSearch}
                  onChange={(e) => setNcrSearch(e.target.value)}
                />
                <Select value={ncrStatusFilter} onValueChange={setNcrStatusFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="resolved">Resolvida</SelectItem>
                    <SelectItem value="closed">Fechada</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ncrSeverityFilter} onValueChange={setNcrSeverityFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as severidades</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { setEditingNcr(null); setNcrDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nova NCR
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ncrsLoading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!ncrsLoading && filteredNcrs.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhuma NCR encontrada</TableCell></TableRow>
                    )}
                    {filteredNcrs.map((ncr) => (
                      <TableRow key={ncr.id}>
                        <TableCell className="text-sm text-muted-foreground font-mono">#{ncr.id}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm max-w-[200px] truncate">{ncr.title}</div>
                          {ncr.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{ncr.description}</div>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ncr.productName ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={ncr.severity} /></TableCell>
                        <TableCell><StatusBadge status={ncr.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ncr.assignedTo ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {ncr.dueDate ? fmtDate(ncr.dueDate) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {(ncr.status === "open" || ncr.status === "in_progress") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                title="Resolver"
                                onClick={() => setResolveNcr(ncr)}
                              >
                                <CheckCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => { setEditingNcr(ncr); setNcrDialog(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteNcr(ncr)}>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <InspectionDialog
        open={inspDialog}
        onClose={() => { setInspDialog(false); setEditingInsp(null); }}
        editing={editingInsp}
        products={activeProducts}
      />

      <NcrDialog
        open={ncrDialog}
        onClose={() => { setNcrDialog(false); setEditingNcr(null); }}
        editing={editingNcr}
        products={activeProducts}
        inspections={inspections}
      />

      {/* Delete inspection */}
      <AlertDialog open={!!deleteInsp} onOpenChange={(v) => !v && setDeleteInsp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir inspeção?</AlertDialogTitle>
            <AlertDialogDescription>
              A inspeção de {fmtDate(deleteInsp?.inspectionDate)} será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteInspMutation.mutate({ id: deleteInsp!.id }, {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: getListQualityInspectionsQueryKey() });
                    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
                    setDeleteInsp(null);
                  },
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete NCR */}
      <AlertDialog open={!!deleteNcr} onOpenChange={(v) => !v && setDeleteNcr(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir NCR?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteNcr?.title}" será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteNcrMutation.mutate({ id: deleteNcr!.id }, {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: getListQualityNcrsQueryKey() });
                    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
                    setDeleteNcr(null);
                  },
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolve NCR */}
      <AlertDialog open={!!resolveNcr} onOpenChange={(v) => !v && setResolveNcr(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar NCR como resolvida?</AlertDialogTitle>
            <AlertDialogDescription>
              "{resolveNcr?.title}" será marcada como resolvida com a data e hora atual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                resolveNcrMutation.mutate({ id: resolveNcr!.id, data: {} }, {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: getListQualityNcrsQueryKey() });
                    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
                    setResolveNcr(null);
                  },
                })
              }
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
