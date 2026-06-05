import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFormulas,
  useCreateFormula,
  useUpdateFormula,
  useDeleteFormula,
  useApproveFormula,
  useObsoleteFormula,
  useAddFormulaItem,
  useDeleteFormulaItem,
  useListProductionOrders,
  useCreateProductionOrder,
  useDeleteProductionOrder,
  useGetProductionOrder,
  useReleaseProductionOrder,
  useStartProductionOrder,
  useSendProductionOrderToQualityCheck,
  useFinishProductionOrder,
  useCancelProductionOrder,
  useStartProductionStage,
  useFinishProductionStage,
  useGetFormula,
  useGetProducaoDashboard,
  useGetProductionTraceabilityByLot,
  useListSalesOrders,
  useListProducts,
  useListProductLots,
  getListFormulasQueryKey,
  getListProductionOrdersQueryKey,
  getGetProductionOrderQueryKey,
  getGetProducaoDashboardQueryKey,
} from "@workspace/api-client-react";
import type {
  Formula,
  FormulaDetail,
  ProductionOrder,
  ProductionOrderDetail,
  ProductionStage,
  ProductLot,
  SalesOrder,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  FlaskConical,
  Factory,
  Package,
  CheckCheck,
  AlertTriangle,
  ClipboardList,
  Eye,
  ChevronRight,
  Ban,
  Search,
  RefreshCw,
  ArrowLeftRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtNum(v: string | number | null | undefined, decimals = 3) {
  if (v === null || v === undefined || v === "") return "—";
  return parseFloat(String(v)).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── Status config ────────────────────────────────────────────────────────────

const FORMULA_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  approved: { label: "Aprovada", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  obsolete: { label: "Obsoleta", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
};

const OP_STATUS: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  planned: { label: "Planejada", className: "bg-muted text-muted-foreground", icon: Clock },
  released: { label: "Liberada", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400", icon: CheckCircle2 },
  in_production: { label: "Em Produção", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: Factory },
  quality_check: { label: "Em CQ", className: "bg-purple-500/15 text-purple-700 dark:text-purple-400", icon: FlaskConical },
  finished: { label: "Finalizada", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", icon: CheckCheck },
  cancelled: { label: "Cancelada", className: "bg-red-500/15 text-red-700 dark:text-red-400", icon: XCircle },
};

const STAGE_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "Em andamento", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  done: { label: "Concluída", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
};

const STAGE_TYPE_LABEL: Record<string, string> = {
  weighing: "Pesagem",
  mixing: "Mistura",
  production: "Produção",
  packaging: "Envase/Embalagem",
};

const ITEM_FUNCTION_LABEL: Record<string, string> = {
  ativo: "Ativo",
  excipiente: "Excipiente",
  conservante: "Conservante",
  solvente: "Solvente",
  emulsificante: "Emulsificante",
  outros: "Outros",
};

function FormulaBadge({ status }: { status: string }) {
  const cfg = FORMULA_STATUS[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function OpBadge({ status }: { status: string }) {
  const cfg = OP_STATUS[status] ?? { label: status, className: "bg-muted text-muted-foreground", icon: Clock };
  const Icon = cfg.icon;
  return (
    <Badge className={`text-xs inline-flex items-center gap-1 ${cfg.className}`}>
      <Icon className="size-3" />{cfg.label}
    </Badge>
  );
}

function StageBadge({ status }: { status: string }) {
  const cfg = STAGE_STATUS[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

// ─── Dashboard Cards ──────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, color }: { title: string; value: number | string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProducaoPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("dashboard");

  // ── Traceability by PA lot ─────────────────────────────────────────────────
  const [lotSearch, setLotSearch] = useState("");
  const [lotSearchInput, setLotSearchInput] = useState("");
  const lotTraceQ = useGetProductionTraceabilityByLot(lotSearch, { query: { enabled: !!lotSearch } as any });
  const lotTrace = lotTraceQ.data;

  // ── Formula state ────────────────────────────────────────────────────────
  const [formulaSearch, setFormulaSearch] = useState("");
  const [formulaStatusFilter, setFormulaStatusFilter] = useState<string>("all");
  const [formulaDialog, setFormulaDialog] = useState<{ open: boolean; formula?: Formula }>({ open: false });
  const [deleteFormulaId, setDeleteFormulaId] = useState<number | null>(null);
  const [formulaDetailId, setFormulaDetailId] = useState<number | null>(null);
  const [itemDialog, setItemDialog] = useState<{ open: boolean; formulaId?: number }>({ open: false });

  // Formula form state
  const [fProductId, setFProductId] = useState("");
  const [fProductName, setFProductName] = useState("");
  const [fVersion, setFVersion] = useState("1.0");
  const [fBatchYield, setFBatchYield] = useState("");
  const [fUnit, setFUnit] = useState("kg");
  const [fNotes, setFNotes] = useState("");

  // Item form state
  const [iProductId, setIProductId] = useState("");
  const [iProductName, setIProductName] = useState("");
  const [iQuantity, setIQuantity] = useState("");
  const [iUnit, setIUnit] = useState("kg");
  const [iFunction, setIFunction] = useState("");
  const [iNotes, setINotes] = useState("");

  // ── OP state ─────────────────────────────────────────────────────────────
  const [opSearch, setOpSearch] = useState("");
  const [opStatusFilter, setOpStatusFilter] = useState<string>("all");
  const [opDialog, setOpDialog] = useState(false);
  const [deleteOpId, setDeleteOpId] = useState<number | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<number | null>(null);
  const [opDetailOpen, setOpDetailOpen] = useState(false);
  const [finishOpDialog, setFinishOpDialog] = useState(false);
  const [finishActualQty, setFinishActualQty] = useState("");
  const [qcActualQty, setQcActualQty] = useState("");
  const [qcDialog, setQcDialog] = useState(false);
  const [cancelOpDialog, setCancelOpDialog] = useState(false);

  // OP form state
  const [opFormulaId, setOpFormulaId] = useState("");
  const [opProductName, setOpProductName] = useState("");
  const [opProductId, setOpProductId] = useState("");
  const [opPlannedQty, setOpPlannedQty] = useState("");
  const [opUnit, setOpUnit] = useState("kg");
  const [opScheduledStart, setOpScheduledStart] = useState("");
  const [opScheduledEnd, setOpScheduledEnd] = useState("");
  const [opNotes, setOpNotes] = useState("");
  const [opSalesOrderId, setOpSalesOrderId] = useState("");

  // Formula version comparison
  const [compareDialog, setCompareDialog] = useState(false);
  const [compareFormulaAId, setCompareFormulaAId] = useState("");
  const [compareFormulaBId, setCompareFormulaBId] = useState("");

  // Stage apontamento state
  const [stageDialog, setStageDialog] = useState<{ open: boolean; stage?: ProductionStage; mode: "start" | "finish" }>({ open: false, mode: "start" });
  const [stOperator, setStOperator] = useState("");
  const [stEquipment, setStEquipment] = useState("");
  const [stQtyIn, setStQtyIn] = useState("");
  const [stQtyOut, setStQtyOut] = useState("");
  const [stLosses, setStLosses] = useState("");
  const [stNotes, setStNotes] = useState("");
  // Lot consumptions for pesagem (weighing) stage
  const [stConsumptions, setStConsumptions] = useState<Array<{ formulaItemId: number; lotId: number; actualQty: string; productName: string; plannedQty: string; }>>([]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const dashboardQ = useGetProducaoDashboard();
  const formulasQ = useListFormulas({
    search: formulaSearch || undefined,
    status: (formulaStatusFilter !== "all" ? formulaStatusFilter : undefined) as any,
  });
  const productsRawQ = useListProducts({ pageSize: 500 });
  const productsQ = { ...productsRawQ, data: productsRawQ.data?.items ?? [] };
  const ordersQ = useListProductionOrders({
    search: opSearch || undefined,
    status: (opStatusFilter !== "all" ? opStatusFilter : undefined) as any,
  });
  const opDetailQ = useGetProductionOrder(selectedOpId ?? 0, {
    query: { enabled: !!selectedOpId } as any,
  });

  const opDetail = opDetailQ.data as ProductionOrderDetail | undefined;

  // Sales orders for OP creation linkage
  const salesOrdersQ = useListSalesOrders({ status: "production_planned" } as any);
  const salesOrders = (salesOrdersQ.data ?? []) as SalesOrder[];

  // Formula comparison
  const compareAQ = useGetFormula(Number(compareFormulaAId) || 0, { query: { enabled: !!compareFormulaAId && compareDialog } as any });
  const compareBQ = useGetFormula(Number(compareFormulaBId) || 0, { query: { enabled: !!compareFormulaBId && compareDialog } as any });
  const compareADetail = compareAQ.data as FormulaDetail | undefined;
  const compareBDetail = compareBQ.data as FormulaDetail | undefined;

  // Approved lots for pesagem lot selection (only fetch when a stage finish dialog is open for weighing)
  const isWeighingFinish = stageDialog.open && stageDialog.mode === "finish" && stageDialog.stage?.stageType === "weighing";
  const approvedLotsQ = useListProductLots({ cqStatus: "approved" } as any, {
    query: { enabled: isWeighingFinish } as any,
  });
  const approvedLots = (approvedLotsQ.data ?? []) as ProductLot[];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createFormulaMut = useCreateFormula();
  const updateFormulaMut = useUpdateFormula();
  const deleteFormulaMut = useDeleteFormula();
  const approveFormulaMut = useApproveFormula();
  const obsoleteFormulaMut = useObsoleteFormula();
  const addItemMut = useAddFormulaItem();
  const deleteItemMut = useDeleteFormulaItem();

  const createOpMut = useCreateProductionOrder();
  const deleteOpMut = useDeleteProductionOrder();
  const releaseOpMut = useReleaseProductionOrder();
  const startOpMut = useStartProductionOrder();
  const qcOpMut = useSendProductionOrderToQualityCheck();
  const finishOpMut = useFinishProductionOrder();
  const cancelOpMut = useCancelProductionOrder();

  const startStageMut = useStartProductionStage();
  const finishStageMut = useFinishProductionStage();

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: getListFormulasQueryKey() });
    qc.invalidateQueries({ queryKey: getListProductionOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetProducaoDashboardQueryKey() });
    if (selectedOpId) qc.invalidateQueries({ queryKey: getGetProductionOrderQueryKey(selectedOpId) });
  }

  // ── Formula actions ───────────────────────────────────────────────────────

  function openNewFormula() {
    setFProductId("");
    setFProductName("");
    setFVersion("1.0");
    setFBatchYield("");
    setFUnit("kg");
    setFNotes("");
    setFormulaDialog({ open: true });
  }

  function openEditFormula(f: Formula) {
    setFProductId(f.productId ? String(f.productId) : "");
    setFProductName(f.productName);
    setFVersion(f.version);
    setFBatchYield(f.batchYield);
    setFUnit(f.unit);
    setFNotes(f.notes ?? "");
    setFormulaDialog({ open: true, formula: f });
  }

  function saveFormula() {
    const body = {
      productId: fProductId ? Number(fProductId) : null,
      productName: fProductName,
      version: fVersion,
      batchYield: fBatchYield,
      unit: fUnit,
      notes: fNotes || undefined,
    };
    if (!fProductName) { toast({ title: "Nome do produto obrigatório", variant: "destructive" }); return; }
    if (formulaDialog.formula) {
      updateFormulaMut.mutate({ id: formulaDialog.formula.id, data: body }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListFormulasQueryKey() }); setFormulaDialog({ open: false }); toast({ title: "Fórmula atualizada" }); },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro ao atualizar", variant: "destructive" }),
      });
    } else {
      createFormulaMut.mutate({ data: body }, {
        onSuccess: (data) => {
          qc.invalidateQueries({ queryKey: getListFormulasQueryKey() });
          setFormulaDialog({ open: false });
          toast({ title: `Fórmula ${data.productName} criada` });
          // auto-open detail
          setFormulaDetailId(data.id);
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro ao criar", variant: "destructive" }),
      });
    }
  }

  function approveFormula(id: number) {
    approveFormulaMut.mutate({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListFormulasQueryKey() }); toast({ title: "Fórmula aprovada" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  function obsoleteFormula(id: number) {
    obsoleteFormulaMut.mutate({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListFormulasQueryKey() }); toast({ title: "Fórmula marcada como obsoleta" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  function confirmDeleteFormula() {
    if (!deleteFormulaId) return;
    deleteFormulaMut.mutate({ id: deleteFormulaId }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListFormulasQueryKey() }); setDeleteFormulaId(null); toast({ title: "Fórmula excluída" }); },
      onError: (e: any) => { setDeleteFormulaId(null); toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }); },
    });
  }

  // ── Item actions ──────────────────────────────────────────────────────────

  function openAddItem(formulaId: number) {
    setIProductId("");
    setIProductName("");
    setIQuantity("");
    setIUnit("kg");
    setIFunction("");
    setINotes("");
    setItemDialog({ open: true, formulaId });
  }

  function saveItem() {
    if (!itemDialog.formulaId) return;
    if (!iProductName || !iQuantity) { toast({ title: "Matéria-prima e quantidade são obrigatórias", variant: "destructive" }); return; }
    addItemMut.mutate({ id: itemDialog.formulaId, data: { productId: iProductId ? Number(iProductId) : null, productName: iProductName, quantity: iQuantity, unit: iUnit, function: iFunction || undefined, notes: iNotes || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFormulasQueryKey() });
        setItemDialog({ open: false });
        toast({ title: "Componente adicionado" });
      },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  function deleteItem(id: number) {
    deleteItemMut.mutate({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListFormulasQueryKey() }); toast({ title: "Componente removido" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  // ── OP actions ────────────────────────────────────────────────────────────

  function openNewOp() {
    setOpFormulaId("");
    setOpProductName("");
    setOpProductId("");
    setOpPlannedQty("");
    setOpUnit("kg");
    setOpScheduledStart("");
    setOpScheduledEnd("");
    setOpNotes("");
    setOpSalesOrderId("");
    setOpDialog(true);
  }

  function saveOp() {
    if (!opProductName || !opPlannedQty) { toast({ title: "Produto e quantidade planejada são obrigatórios", variant: "destructive" }); return; }
    const body = {
      formulaId: opFormulaId ? Number(opFormulaId) : null,
      productId: opProductId ? Number(opProductId) : null,
      productName: opProductName,
      plannedQty: opPlannedQty,
      unit: opUnit,
      scheduledStart: opScheduledStart || undefined,
      scheduledEnd: opScheduledEnd || undefined,
      notes: opNotes || undefined,
      salesOrderId: opSalesOrderId ? Number(opSalesOrderId) : undefined,
    };
    createOpMut.mutate({ data: body }, {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListProductionOrdersQueryKey() });
        qc.invalidateQueries({ queryKey: getGetProducaoDashboardQueryKey() });
        setOpDialog(false);
        toast({ title: `${data.number} criada` });
        setSelectedOpId(data.id);
        setOpDetailOpen(true);
      },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  function releaseOp(id: number) {
    releaseOpMut.mutate({ id }, {
      onSuccess: () => { invalidateAll(); toast({ title: "OP liberada para produção" }); },
      onError: (e: any) => {
        const err = e?.response?.data;
        const shortages: string[] = err?.shortages ?? [];
        toast({ title: err?.error ?? "Erro ao liberar OP", description: shortages.join("\n"), variant: "destructive" });
      },
    });
  }

  function startOp(id: number) {
    startOpMut.mutate({ id }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Produção iniciada" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  function sendToQc() {
    if (!selectedOpId) return;
    qcOpMut.mutate({ id: selectedOpId, data: { actualQty: qcActualQty || undefined } }, {
      onSuccess: () => { invalidateAll(); setQcDialog(false); toast({ title: "OP enviada ao controle de qualidade" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  function finishOp() {
    if (!selectedOpId) return;
    finishOpMut.mutate({ id: selectedOpId, data: { actualQty: finishActualQty || undefined } }, {
      onSuccess: (data: any) => {
        invalidateAll();
        setFinishOpDialog(false);
        const lot = data?.createdLot?.internalLot ?? data?.order?.batchLot;
        toast({ title: "OP finalizada com sucesso", description: lot ? `Lote PA criado: ${lot}` : undefined });
      },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  function cancelOp(id: number) {
    cancelOpMut.mutate({ id }, {
      onSuccess: () => { invalidateAll(); setCancelOpDialog(false); toast({ title: "OP cancelada" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  }

  function confirmDeleteOp() {
    if (!deleteOpId) return;
    deleteOpMut.mutate({ id: deleteOpId }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListProductionOrdersQueryKey() }); setDeleteOpId(null); toast({ title: "OP excluída" }); },
      onError: (e: any) => { setDeleteOpId(null); toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }); },
    });
  }

  // ── Stage actions ─────────────────────────────────────────────────────────

  function openStartStage(stage: ProductionStage) {
    setStOperator("");
    setStEquipment("");
    setStQtyIn("");
    setStNotes("");
    setStageDialog({ open: true, stage, mode: "start" });
  }

  function openFinishStage(stage: ProductionStage) {
    setStQtyOut(stage.qtyIn ?? "");
    setStLosses("");
    setStNotes("");
    // Pre-fill consumptions from formula items for pesagem stage
    if (stage.stageType === "weighing" && opDetail?.formulaItems?.length) {
      const batchYield = opDetail.formulaItems.length > 0 ? parseFloat(opDetail.plannedQty ?? "0") : 0;
      setStConsumptions(opDetail.formulaItems.map((fi: any) => ({
        formulaItemId: fi.id,
        lotId: 0,
        actualQty: fi.quantity ?? "",
        productName: fi.productName,
        plannedQty: fi.quantity ?? "",
      })));
    } else {
      setStConsumptions([]);
    }
    setStageDialog({ open: true, stage, mode: "finish" });
  }

  function executeStage() {
    const stage = stageDialog.stage;
    if (!stage) return;
    if (stageDialog.mode === "start") {
      startStageMut.mutate({ id: stage.id, data: { operatorName: stOperator || undefined, equipment: stEquipment || undefined, qtyIn: stQtyIn || undefined } }, {
        onSuccess: () => { invalidateAll(); setStageDialog({ open: false, mode: "start" }); toast({ title: `Etapa "${STAGE_TYPE_LABEL[stage.stageType]}" iniciada` }); },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
      });
    } else {
      const validConsumptions = stConsumptions.filter((c) => c.lotId > 0 && parseFloat(c.actualQty) > 0);
      finishStageMut.mutate({
        id: stage.id,
        data: {
          qtyOut: stQtyOut || undefined,
          losses: stLosses || undefined,
          notes: stNotes || undefined,
          consumptions: validConsumptions.length > 0 ? validConsumptions.map((c) => ({
            formulaItemId: c.formulaItemId || undefined,
            lotId: c.lotId,
            actualQty: parseFloat(c.actualQty),
            plannedQty: c.plannedQty ? parseFloat(c.plannedQty) : undefined,
          })) : undefined,
        } as any,
      }, {
        onSuccess: () => { invalidateAll(); setStageDialog({ open: false, mode: "start" }); toast({ title: `Etapa "${STAGE_TYPE_LABEL[stage.stageType]}" concluída` }); },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Erro", variant: "destructive" }),
      });
    }
  }

  // ── Formula detail (expandable in the list) ──────────────────────────────

  const formulaDetails: Record<number, FormulaDetail | undefined> = {};

  // ── Render ────────────────────────────────────────────────────────────────

  const formulas = formulasQ.data ?? [];
  const orders = ordersQ.data ?? [];
  const dashboard = dashboardQ.data;
  const products = productsQ.data ?? [];

  const filteredFormulas = formulas.filter((f) => {
    const matchSearch = !formulaSearch || f.productName.toLowerCase().includes(formulaSearch.toLowerCase()) || f.version.toLowerCase().includes(formulaSearch.toLowerCase());
    const matchStatus = formulaStatusFilter === "all" || f.status === formulaStatusFilter;
    return matchSearch && matchStatus;
  });

  const filteredOrders = orders.filter((o) => {
    const matchSearch = !opSearch || o.number.toLowerCase().includes(opSearch.toLowerCase()) || o.productName.toLowerCase().includes(opSearch.toLowerCase()) || (o.batchLot ?? "").toLowerCase().includes(opSearch.toLowerCase());
    const matchStatus = opStatusFilter === "all" || o.status === opStatusFilter;
    return matchSearch && matchStatus;
  });

  const activeOrders = orders.filter((o) => ["released", "in_production", "quality_check"].includes(o.status));

  return (
    <AppLayout>
      <PageHeader
        title="Produção"
        subtitle="Gestão de fórmulas, ordens de produção e chão de fábrica"
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="formulas">Fórmulas</TabsTrigger>
          <TabsTrigger value="ordens">Ordens de Produção</TabsTrigger>
          <TabsTrigger value="apontamento">Apontamento</TabsTrigger>
          <TabsTrigger value="rastreabilidade">Rastreabilidade</TabsTrigger>
        </TabsList>

        {/* ── Dashboard ─────────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4">
          {dashboardQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard title="Total de OPs" value={dashboard.totalOrders} />
                <KpiCard title="Em Produção" value={dashboard.inProduction} color="text-amber-600 dark:text-amber-400" />
                <KpiCard title="Aguardando CQ" value={dashboard.qualityCheck} color="text-purple-600 dark:text-purple-400" />
                <KpiCard title="Finalizadas" value={dashboard.finished} color="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard title="Planejadas" value={dashboard.planned} />
                <KpiCard title="Liberadas" value={dashboard.released} color="text-blue-600 dark:text-blue-400" />
                <KpiCard title="Total de Fórmulas" value={dashboard.totalFormulas} />
                <KpiCard title="Fórmulas Aprovadas" value={dashboard.approvedFormulas} color="text-emerald-600 dark:text-emerald-400" />
              </div>
              {dashboard.recentOrders.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Últimas Ordens de Produção</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Qtde Planejada</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Início Planejado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.recentOrders.map((o) => (
                          <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedOpId(o.id); setOpDetailOpen(true); setTab("ordens"); }}>
                            <TableCell className="font-mono text-sm font-medium">{o.number}</TableCell>
                            <TableCell>{o.productName}</TableCell>
                            <TableCell>{fmtNum(o.plannedQty)} {o.unit}</TableCell>
                            <TableCell><OpBadge status={o.status} /></TableCell>
                            <TableCell>{o.scheduledStart ? fmtDate(o.scheduledStart) : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum dado disponível</div>
          )}
        </TabsContent>

        {/* ── Fórmulas ──────────────────────────────────────────────────── */}
        <TabsContent value="formulas" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input placeholder="Buscar fórmulas..." className="pl-8 h-8 text-sm" value={formulaSearch} onChange={(e) => setFormulaSearch(e.target.value)} />
            </div>
            <Select value={formulaStatusFilter} onValueChange={setFormulaStatusFilter}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="approved">Aprovada</SelectItem>
                <SelectItem value="obsolete">Obsoleta</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => { setCompareFormulaAId(""); setCompareFormulaBId(""); setCompareDialog(true); }}>
              <ArrowLeftRight className="size-3.5 mr-1" />Comparar Versões
            </Button>
            <Button size="sm" onClick={openNewFormula}>
              <Plus className="size-3.5 mr-1" />Nova Fórmula
            </Button>
          </div>

          {formulasQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : filteredFormulas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma fórmula encontrada</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openNewFormula}>
                <Plus className="size-3.5 mr-1" />Criar primeira fórmula
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFormulas.map((formula) => (
                <FormulaCard
                  key={formula.id}
                  formula={formula}
                  isExpanded={formulaDetailId === formula.id}
                  onToggle={() => setFormulaDetailId(formulaDetailId === formula.id ? null : formula.id)}
                  onEdit={() => openEditFormula(formula)}
                  onApprove={() => approveFormula(formula.id)}
                  onObsolete={() => obsoleteFormula(formula.id)}
                  onDelete={() => setDeleteFormulaId(formula.id)}
                  onAddItem={() => openAddItem(formula.id)}
                  onDeleteItem={deleteItem}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Ordens de Produção ─────────────────────────────────────────── */}
        <TabsContent value="ordens" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input placeholder="Buscar OPs..." className="pl-8 h-8 text-sm" value={opSearch} onChange={(e) => setOpSearch(e.target.value)} />
            </div>
            <Select value={opStatusFilter} onValueChange={setOpStatusFilter}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(OP_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={openNewOp}>
              <Plus className="size-3.5 mr-1" />Nova OP
            </Button>
          </div>

          {ordersQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma ordem de produção encontrada</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openNewOp}>
                <Plus className="size-3.5 mr-1" />Criar primeira OP
              </Button>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Fórmula</TableHead>
                    <TableHead>Qtde Planejada</TableHead>
                    <TableHead>Lote PA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Início Planejado</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-mono text-sm font-medium">{op.number}</TableCell>
                      <TableCell className="font-medium">{op.productName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{op.formulaVersion ? `v${op.formulaVersion}` : "—"}</TableCell>
                      <TableCell>{fmtNum(op.plannedQty)} {op.unit}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{op.batchLot ?? "—"}</TableCell>
                      <TableCell><OpBadge status={op.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{op.scheduledStart ? fmtDate(op.scheduledStart) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-7" title="Detalhes" onClick={() => { setSelectedOpId(op.id); setOpDetailOpen(true); }}>
                            <Eye className="size-3.5" />
                          </Button>
                          {op.status === "planned" && (
                            <Button variant="ghost" size="icon" className="size-7" title="Liberar" onClick={() => releaseOp(op.id)}>
                              <CheckCircle2 className="size-3.5 text-blue-500" />
                            </Button>
                          )}
                          {["planned", "cancelled"].includes(op.status) && (
                            <Button variant="ghost" size="icon" className="size-7 text-destructive" title="Excluir" onClick={() => setDeleteOpId(op.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── Apontamento ────────────────────────────────────────────────── */}
        <TabsContent value="apontamento" className="space-y-4">
          <p className="text-sm text-muted-foreground">Selecione uma OP ativa para registrar as etapas de produção.</p>
          {activeOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Factory className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma OP ativa no momento</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {activeOrders.map((op) => (
                <Card key={op.id} className={`cursor-pointer border-2 transition-colors ${selectedOpId === op.id ? "border-primary" : "border-transparent hover:border-muted-foreground/30"}`} onClick={() => setSelectedOpId(op.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-mono text-sm font-bold">{op.number}</span>
                      <OpBadge status={op.status} />
                    </div>
                    <p className="font-medium text-sm">{op.productName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtNum(op.plannedQty)} {op.unit} planejados</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedOpId && opDetail && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{opDetail.number} — {opDetail.productName}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtNum(opDetail.plannedQty)} {opDetail.unit} planejados · <OpBadge status={opDetail.status} /></p>
                  </div>
                  <div className="flex gap-2">
                    {opDetail.status === "released" && (
                      <Button size="sm" onClick={() => startOp(opDetail.id)}>
                        <Play className="size-3.5 mr-1" />Iniciar Produção
                      </Button>
                    )}
                    {opDetail.status === "in_production" && (
                      <Button size="sm" variant="outline" onClick={() => { setQcActualQty(opDetail.actualQty ?? ""); setQcDialog(true); }}>
                        <FlaskConical className="size-3.5 mr-1" />Enviar ao CQ
                      </Button>
                    )}
                    {opDetail.status === "quality_check" && (
                      <Button size="sm" onClick={() => { setFinishActualQty(opDetail.actualQty ?? ""); setFinishOpDialog(true); }}>
                        <CheckCheck className="size-3.5 mr-1" />Finalizar OP
                      </Button>
                    )}
                    {!["finished", "cancelled"].includes(opDetail.status) && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelOpDialog(true)}>
                        <Ban className="size-3.5 mr-1" />Cancelar
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-8" onClick={invalidateAll}>
                      <RefreshCw className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Etapas</h4>
                {(opDetail.stages ?? []).map((stage) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    opStatus={opDetail.status}
                    onStart={() => openStartStage(stage)}
                    onFinish={() => openFinishStage(stage)}
                  />
                ))}
                {opDetail.formulaItems && opDetail.formulaItems.length > 0 && (
                  <>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4">Matérias-primas</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matéria-prima</TableHead>
                          <TableHead>Função</TableHead>
                          <TableHead>Qtde por batch</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opDetail.formulaItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm">{item.productName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.function ? ITEM_FUNCTION_LABEL[item.function] ?? item.function : "—"}</TableCell>
                            <TableCell className="text-sm">{fmtNum(item.quantity, 4)} {item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Rastreabilidade por Lote PA ─────────────────────────────── */}
        <TabsContent value="rastreabilidade" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Busca por Lote de Produto Acabado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="Ex: PA-OP-001-ABC123"
                  value={lotSearchInput}
                  onChange={(e) => setLotSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setLotSearch(lotSearchInput.trim()); }}
                />
                <Button size="sm" onClick={() => setLotSearch(lotSearchInput.trim())}>
                  <Search className="size-3.5 mr-1" />Buscar
                </Button>
                {lotSearch && (
                  <Button size="sm" variant="ghost" onClick={() => { setLotSearch(""); setLotSearchInput(""); }}>
                    Limpar
                  </Button>
                )}
              </div>

              {lotSearch && lotTraceQ.isLoading && (
                <div className="text-sm text-muted-foreground">Buscando rastreabilidade do lote {lotSearch}…</div>
              )}
              {lotSearch && lotTraceQ.isError && (
                <div className="text-sm text-destructive">Lote PA não encontrado: <span className="font-mono">{lotSearch}</span></div>
              )}
              {lotTrace && (
                <div className="space-y-4">
                  {/* OP summary */}
                  <div className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{(lotTrace as any).order?.productName} — {(lotTrace as any).order?.number}</p>
                      <OpBadge status={(lotTrace as any).order?.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>Lote PA: <span className="font-mono text-foreground">{(lotTrace as any).order?.batchLot}</span></span>
                      <span>Qtde Real: <span className="font-medium text-foreground">{fmtNum((lotTrace as any).order?.actualQty)} {(lotTrace as any).order?.unit}</span></span>
                      <span>Fórmula v.{(lotTrace as any).order?.formulaVersion ?? "—"}</span>
                    </div>
                  </div>

                  {/* Consumed MP lots */}
                  {(() => {
                    const consumptions = (lotTrace as any).consumptions as Array<{
                      id: number; productName: string; internalLot: string | null;
                      supplierLot: string | null; actualQty: string; plannedQty: string | null;
                      unit: string; cqStatus: string | null; recordedBy: string | null;
                    }>;
                    if (!consumptions || consumptions.length === 0) return (
                      <p className="text-xs text-muted-foreground">Nenhum consumo de lote registrado para esta OP.</p>
                    );
                    return (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Matérias-Primas Consumidas</p>
                        <div className="border rounded-md divide-y text-xs">
                          {consumptions.map((c) => (
                            <div key={c.id} className="flex items-center justify-between px-3 py-2 gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{c.productName}</p>
                                <p className="text-muted-foreground font-mono">{c.internalLot ?? "—"}{c.supplierLot ? ` / Forn: ${c.supplierLot}` : ""}</p>
                                {c.cqStatus && (
                                  <Badge variant={c.cqStatus === "approved" ? "default" : "secondary"} className="text-[10px] h-4 mt-0.5">
                                    CQ: {c.cqStatus}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-semibold">{fmtNum(c.actualQty)} {c.unit}</p>
                                {c.plannedQty && <p className="text-muted-foreground">plan: {fmtNum(c.plannedQty)}</p>}
                                {c.recordedBy && <p className="text-muted-foreground">por: {c.recordedBy}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Stages */}
                  {((lotTrace as any).stages as any[])?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Etapas de Produção</p>
                      <div className="space-y-1.5">
                        {((lotTrace as any).stages as any[]).map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between border rounded px-3 py-1.5 text-xs">
                            <span className="font-medium">{STAGE_TYPE_LABEL[s.stageType as keyof typeof STAGE_TYPE_LABEL] ?? s.stageType}</span>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              {s.operatorName && <span>Op: {s.operatorName}</span>}
                              {s.qtyOut && <span>{fmtNum(s.qtyOut)} kg saída</span>}
                              {s.yield && <span className="text-emerald-600">{parseFloat(s.yield).toFixed(1)}% rend.</span>}
                              <Badge variant={s.status === "done" ? "default" : s.status === "in_progress" ? "secondary" : "outline"} className="text-[10px] h-4">
                                {s.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}

      {/* Formula create/edit dialog */}
      <Dialog open={formulaDialog.open} onOpenChange={(o) => !o && setFormulaDialog({ open: false })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{formulaDialog.formula ? "Editar Fórmula" : "Nova Fórmula"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Produto Acabado *</Label>
                <Select value={fProductId || "__manual"} onValueChange={(v) => {
                  if (v === "__manual") { setFProductId(""); return; }
                  const p = products.find((p) => String(p.id) === v);
                  if (p) { setFProductId(v); setFProductName(p.name); }
                }}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue placeholder="Selecionar produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual">Digitar manualmente</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(!fProductId || fProductId === "") && (
                <div className="col-span-2">
                  <Label className="text-xs">Nome do Produto *</Label>
                  <Input className="h-8 text-sm mt-1" value={fProductName} onChange={(e) => setFProductName(e.target.value)} placeholder="Ex: Creme Hidratante 200g" />
                </div>
              )}
              <div>
                <Label className="text-xs">Versão</Label>
                <Input className="h-8 text-sm mt-1" value={fVersion} onChange={(e) => setFVersion(e.target.value)} placeholder="1.0" />
              </div>
              <div>
                <Label className="text-xs">Rendimento do Batch</Label>
                <div className="flex gap-1 mt-1">
                  <Input className="h-8 text-sm" value={fBatchYield} onChange={(e) => setFBatchYield(e.target.value)} placeholder="0" />
                  <Select value={fUnit} onValueChange={setFUnit}>
                    <SelectTrigger className="h-8 w-24 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["kg", "g", "L", "mL", "un"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea className="text-sm mt-1 resize-none" rows={2} value={fNotes} onChange={(e) => setFNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFormulaDialog({ open: false })}>Cancelar</Button>
            <Button size="sm" onClick={saveFormula} disabled={createFormulaMut.isPending || updateFormulaMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add formula item dialog */}
      <Dialog open={itemDialog.open} onOpenChange={(o) => !o && setItemDialog({ open: false })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Matéria-prima</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Matéria-prima *</Label>
              <Select value={iProductId || "__manual"} onValueChange={(v) => {
                if (v === "__manual") { setIProductId(""); return; }
                const p = products.find((p) => String(p.id) === v);
                if (p) { setIProductId(v); setIProductName(p.name); }
              }}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Selecionar MP..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual">Digitar manualmente</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(!iProductId || iProductId === "") && (
              <div>
                <Label className="text-xs">Nome da MP *</Label>
                <Input className="h-8 text-sm mt-1" value={iProductName} onChange={(e) => setIProductName(e.target.value)} placeholder="Ex: Extrato de Aloe Vera" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade *</Label>
                <div className="flex gap-1 mt-1">
                  <Input className="h-8 text-sm" value={iQuantity} onChange={(e) => setIQuantity(e.target.value)} placeholder="0" />
                  <Select value={iUnit} onValueChange={setIUnit}>
                    <SelectTrigger className="h-8 w-20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["kg", "g", "L", "mL", "%", "un"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Função</Label>
                <Select value={iFunction || "none"} onValueChange={(v) => setIFunction(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {Object.entries(ITEM_FUNCTION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input className="h-8 text-sm mt-1" value={iNotes} onChange={(e) => setINotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setItemDialog({ open: false })}>Cancelar</Button>
            <Button size="sm" onClick={saveItem} disabled={addItemMut.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New OP dialog */}
      <Dialog open={opDialog} onOpenChange={setOpDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Produção</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Sales order linkage */}
            <div>
              <Label className="text-xs">Vincular a Pedido de Venda (opcional)</Label>
              <Select value={opSalesOrderId || "none"} onValueChange={(v) => setOpSalesOrderId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Selecionar pedido..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pedido vinculado</SelectItem>
                  {salesOrders.map((so) => (
                    <SelectItem key={so.id} value={String(so.id)}>
                      #{so.id} {so.clientName ? `— ${so.clientName}` : ""} ({so.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {salesOrders.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">Nenhum PV com status "production_planned" disponível</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Produto Acabado *</Label>
              <Select value={opProductId || "__manual"} onValueChange={(v) => {
                if (v === "__manual") { setOpProductId(""); return; }
                const p = products.find((p) => String(p.id) === v);
                if (p) { setOpProductId(v); setOpProductName(p.name); }
              }}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Selecionar produto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual">Digitar manualmente</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(!opProductId || opProductId === "") && (
              <div>
                <Label className="text-xs">Nome do Produto *</Label>
                <Input className="h-8 text-sm mt-1" value={opProductName} onChange={(e) => setOpProductName(e.target.value)} placeholder="Ex: Creme Hidratante 200g" />
              </div>
            )}
            <div>
              <Label className="text-xs">Fórmula (opcional)</Label>
              <Select value={opFormulaId || "none"} onValueChange={(v) => setOpFormulaId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Selecionar fórmula..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem fórmula vinculada</SelectItem>
                  {formulas.filter((f) => f.status === "approved").map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.productName} v{f.version}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade Planejada *</Label>
                <div className="flex gap-1 mt-1">
                  <Input className="h-8 text-sm" value={opPlannedQty} onChange={(e) => setOpPlannedQty(e.target.value)} placeholder="0" />
                  <Select value={opUnit} onValueChange={setOpUnit}>
                    <SelectTrigger className="h-8 w-20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["kg", "g", "L", "mL", "un"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início Planejado</Label>
                <Input type="date" className="h-8 text-sm mt-1" value={opScheduledStart} onChange={(e) => setOpScheduledStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fim Planejado</Label>
                <Input type="date" className="h-8 text-sm mt-1" value={opScheduledEnd} onChange={(e) => setOpScheduledEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea className="text-sm mt-1 resize-none" rows={2} value={opNotes} onChange={(e) => setOpNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveOp} disabled={createOpMut.isPending}>Criar OP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formula version comparison dialog */}
      <Dialog open={compareDialog} onOpenChange={setCompareDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparar Versões de Fórmula</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fórmula A</Label>
                <Select value={compareFormulaAId || "none"} onValueChange={(v) => setCompareFormulaAId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar fórmula A</SelectItem>
                    {(formulasQ.data ?? []).map((f: Formula) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.productName} v{f.version} ({f.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fórmula B</Label>
                <Select value={compareFormulaBId || "none"} onValueChange={(v) => setCompareFormulaBId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar fórmula B</SelectItem>
                    {(formulasQ.data ?? []).map((f: Formula) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.productName} v{f.version} ({f.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {compareADetail && compareBDetail && (() => {
              const itemsA = compareADetail.items ?? [];
              const itemsB = compareBDetail.items ?? [];
              const allProducts = Array.from(new Set([...itemsA.map((i: any) => i.productName), ...itemsB.map((i: any) => i.productName)]));
              return (
                <div>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="text-xs font-semibold text-center bg-muted/40 rounded p-1">
                      {compareADetail.productName} v{compareADetail.version} <Badge variant="outline" className="text-[10px] ml-1">{compareADetail.status}</Badge>
                    </div>
                    <div className="text-xs font-semibold text-center bg-muted/40 rounded p-1">
                      {compareBDetail.productName} v{compareBDetail.version} <Badge variant="outline" className="text-[10px] ml-1">{compareBDetail.status}</Badge>
                    </div>
                  </div>
                  <div className="border rounded-md divide-y text-xs">
                    <div className="grid grid-cols-[2fr_1fr_1fr] px-3 py-1.5 font-semibold bg-muted/30 text-muted-foreground">
                      <span>Matéria-Prima</span><span className="text-center">v{compareADetail.version}</span><span className="text-center">v{compareBDetail.version}</span>
                    </div>
                    {allProducts.map((productName) => {
                      const ia = itemsA.find((i: any) => i.productName === productName);
                      const ib = itemsB.find((i: any) => i.productName === productName);
                      const changed = ia?.quantity !== ib?.quantity;
                      const added = !ia && !!ib;
                      const removed = !!ia && !ib;
                      return (
                        <div key={productName} className={`grid grid-cols-[2fr_1fr_1fr] px-3 py-2 ${added ? "bg-emerald-50 dark:bg-emerald-950/20" : removed ? "bg-red-50 dark:bg-red-950/20" : changed ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                          <span className="font-medium truncate">
                            {added && <span className="text-emerald-600 mr-1">+</span>}
                            {removed && <span className="text-red-600 mr-1">−</span>}
                            {productName}
                          </span>
                          <span className="text-center text-muted-foreground">{ia ? `${fmtNum(ia.quantity)} ${ia.unit}` : "—"}</span>
                          <span className={`text-center ${changed && !added && !removed ? "font-semibold text-amber-600" : ""}`}>
                            {ib ? `${fmtNum(ib.quantity)} ${ib.unit}` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 dark:bg-emerald-950/20 border rounded inline-block" />Adicionado</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 dark:bg-red-950/20 border rounded inline-block" />Removido</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-100 dark:bg-amber-950/20 border rounded inline-block" />Qtde alterada</span>
                  </div>
                </div>
              );
            })()}
            {compareFormulaAId && compareBDetail === undefined && compareADetail === undefined && (
              <div className="text-sm text-muted-foreground text-center py-4">Selecione duas fórmulas para comparar</div>
            )}
            {(!compareFormulaAId || !compareFormulaBId) && (
              <div className="text-sm text-muted-foreground text-center py-4">Selecione as fórmulas A e B para ver as diferenças de composição</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* OP Detail dialog */}
      <Dialog open={opDetailOpen} onOpenChange={setOpDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {opDetail ? `${opDetail.number} — ${opDetail.productName}` : "Carregando..."}
            </DialogTitle>
          </DialogHeader>
          {opDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Status</span><div className="mt-1"><OpBadge status={opDetail.status} /></div></div>
                <div><span className="text-muted-foreground text-xs">Qtde Planejada</span><div className="mt-1 font-medium">{fmtNum(opDetail.plannedQty)} {opDetail.unit}</div></div>
                <div><span className="text-muted-foreground text-xs">Qtde Real</span><div className="mt-1 font-medium">{opDetail.actualQty ? `${fmtNum(opDetail.actualQty)} ${opDetail.unit}` : "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">Fórmula v.</span><div className="mt-1">{opDetail.formulaVersion ?? "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">Lote PA</span><div className="mt-1 font-mono text-xs">{opDetail.batchLot ?? "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">Liberado por</span><div className="mt-1">{opDetail.releasedBy ?? "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">Início planejado</span><div className="mt-1">{opDetail.scheduledStart ? fmtDate(opDetail.scheduledStart) : "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">Início real</span><div className="mt-1">{fmtDateTime(opDetail.actualStart)}</div></div>
                <div><span className="text-muted-foreground text-xs">Fim real</span><div className="mt-1">{fmtDateTime(opDetail.actualEnd)}</div></div>
              </div>
              {opDetail.notes && <div className="text-sm bg-muted/40 rounded p-2">{opDetail.notes}</div>}

              {/* Workflow actions */}
              <div className="flex flex-wrap gap-2 pt-1 border-t">
                {opDetail.status === "planned" && (
                  <Button size="sm" onClick={() => { releaseOp(opDetail.id); setOpDetailOpen(false); }}>
                    <CheckCircle2 className="size-3.5 mr-1" />Liberar OP
                  </Button>
                )}
                {opDetail.status === "released" && (
                  <Button size="sm" onClick={() => { startOp(opDetail.id); }}>
                    <Play className="size-3.5 mr-1" />Iniciar Produção
                  </Button>
                )}
                {opDetail.status === "in_production" && (
                  <Button size="sm" variant="outline" onClick={() => { setQcActualQty(opDetail.actualQty ?? ""); setQcDialog(true); }}>
                    <FlaskConical className="size-3.5 mr-1" />Enviar ao CQ
                  </Button>
                )}
                {opDetail.status === "quality_check" && (
                  <Button size="sm" onClick={() => { setFinishActualQty(opDetail.actualQty ?? ""); setFinishOpDialog(true); }}>
                    <CheckCheck className="size-3.5 mr-1" />Finalizar OP
                  </Button>
                )}
                {!["finished", "cancelled"].includes(opDetail.status) && (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelOpDialog(true)}>
                    <Ban className="size-3.5 mr-1" />Cancelar OP
                  </Button>
                )}
              </div>

              {/* Stages */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Etapas de Produção</h4>
                <div className="space-y-2">
                  {(opDetail.stages ?? []).map((stage) => (
                    <StageRow
                      key={stage.id}
                      stage={stage}
                      opStatus={opDetail.status}
                      onStart={() => { openStartStage(stage); }}
                      onFinish={() => { openFinishStage(stage); }}
                    />
                  ))}
                </div>
              </div>

              {/* Rastreabilidade de lotes consumidos */}
              {(() => {
                const consumptions = (opDetail as any).consumptions as Array<{
                  id: number; productName: string; internalLot: string | null;
                  supplierLot: string | null; actualQty: string; plannedQty: string | null;
                  unit: string; cqStatus: string | null; recordedBy: string | null;
                }> | undefined;
                if (!consumptions || consumptions.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rastreabilidade de Matéria-Prima</h4>
                    <div className="border rounded-md divide-y text-xs">
                      {consumptions.map((c) => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.productName}</p>
                            <p className="text-muted-foreground font-mono">{c.internalLot ?? "—"}{c.supplierLot ? ` / Forn: ${c.supplierLot}` : ""}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold">{fmtNum(c.actualQty)} {c.unit}</p>
                            {c.plannedQty && <p className="text-muted-foreground">plan: {fmtNum(c.plannedQty)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send to QC dialog */}
      <Dialog open={qcDialog} onOpenChange={setQcDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Enviar ao Controle de Qualidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Quantidade Real Produzida</Label>
              <Input className="h-8 text-sm mt-1" value={qcActualQty} onChange={(e) => setQcActualQty(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQcDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={sendToQc} disabled={qcOpMut.isPending}>Enviar ao CQ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish OP dialog */}
      <Dialog open={finishOpDialog} onOpenChange={setFinishOpDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Finalizar Ordem de Produção</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Quantidade Real Produzida</Label>
              <Input className="h-8 text-sm mt-1" value={finishActualQty} onChange={(e) => setFinishActualQty(e.target.value)} placeholder="Opcional" />
            </div>
            <p className="text-xs text-muted-foreground">
              Um lote de produto acabado (LOT-PA-YYYY-NNN) será criado automaticamente e o estoque do produto será atualizado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFinishOpDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={finishOp} disabled={finishOpMut.isPending}>Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage start/finish dialog */}
      <Dialog open={stageDialog.open} onOpenChange={(o) => !o && setStageDialog({ open: false, mode: "start" })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {stageDialog.mode === "start" ? "Iniciar" : "Concluir"} Etapa: {stageDialog.stage ? STAGE_TYPE_LABEL[stageDialog.stage.stageType] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {stageDialog.mode === "start" ? (
              <>
                <div>
                  <Label className="text-xs">Operador</Label>
                  <Input className="h-8 text-sm mt-1" value={stOperator} onChange={(e) => setStOperator(e.target.value)} placeholder="Nome do operador" />
                </div>
                <div>
                  <Label className="text-xs">Equipamento</Label>
                  <Input className="h-8 text-sm mt-1" value={stEquipment} onChange={(e) => setStEquipment(e.target.value)} placeholder="Ex: Reator 1, Balança A" />
                </div>
                <div>
                  <Label className="text-xs">Quantidade de Entrada</Label>
                  <Input className="h-8 text-sm mt-1" value={stQtyIn} onChange={(e) => setStQtyIn(e.target.value)} placeholder="kg ou L" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Quantidade de Saída</Label>
                  <Input className="h-8 text-sm mt-1" value={stQtyOut} onChange={(e) => setStQtyOut(e.target.value)} placeholder="kg ou L" />
                </div>
                <div>
                  <Label className="text-xs">Perdas</Label>
                  <Input className="h-8 text-sm mt-1" value={stLosses} onChange={(e) => setStLosses(e.target.value)} placeholder="kg ou L" />
                </div>
                {stQtyIn && stQtyOut && (
                  <div className="text-sm bg-muted/40 rounded p-2">
                    <span className="text-muted-foreground">Rendimento estimado: </span>
                    <span className="font-semibold">
                      {(parseFloat(stQtyOut) / parseFloat(stQtyIn) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {/* Lot consumption tracking — shown for weighing stage with formula items */}
                {stageDialog.stage?.stageType === "weighing" && stConsumptions.length > 0 && (
                  <div className="border rounded-md p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lotes de Matéria-Prima Pesados</p>
                    {stConsumptions.map((c, idx) => {
                      const lotsForProduct = approvedLots.filter((l) => {
                        const anyFi = opDetail?.formulaItems?.find((fi: any) => fi.id === c.formulaItemId);
                        return anyFi ? l.productId === anyFi.productId : false;
                      });
                      return (
                        <div key={idx} className="space-y-1.5">
                          <p className="text-xs font-medium">{c.productName} <span className="text-muted-foreground">(planejado: {fmtNum(c.plannedQty)} kg)</span></p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Lote (CQ Aprovado)</Label>
                              <Select
                                value={c.lotId > 0 ? String(c.lotId) : ""}
                                onValueChange={(v) => setStConsumptions((prev) => prev.map((x, i) => i === idx ? { ...x, lotId: Number(v) } : x))}
                              >
                                <SelectTrigger className="h-8 text-xs mt-1">
                                  <SelectValue placeholder={approvedLotsQ.isLoading ? "Carregando..." : "Selecionar lote"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {lotsForProduct.length === 0 && (
                                    <SelectItem value="0" disabled>Nenhum lote disponível</SelectItem>
                                  )}
                                  {lotsForProduct.map((l) => (
                                    <SelectItem key={l.id} value={String(l.id)}>
                                      {l.internalLot} ({fmtNum(l.availableQty)} kg disp.)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Qtde Real (kg)</Label>
                              <Input
                                className="h-8 text-xs mt-1"
                                type="number"
                                value={c.actualQty}
                                onChange={(e) => setStConsumptions((prev) => prev.map((x, i) => i === idx ? { ...x, actualQty: e.target.value } : x))}
                                placeholder="kg"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea className="text-sm mt-1 resize-none" rows={2} value={stNotes} onChange={(e) => setStNotes(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setStageDialog({ open: false, mode: "start" })}>Cancelar</Button>
            <Button size="sm" onClick={executeStage} disabled={startStageMut.isPending || finishStageMut.isPending}>
              {stageDialog.mode === "start" ? "Iniciar Etapa" : "Concluir Etapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel OP dialog */}
      <AlertDialog open={cancelOpDialog} onOpenChange={setCancelOpDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Ordem de Produção?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A OP será marcada como cancelada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => selectedOpId && cancelOp(selectedOpId)}>Cancelar OP</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete formula */}
      <AlertDialog open={!!deleteFormulaId} onOpenChange={(o) => !o && setDeleteFormulaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fórmula?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação remove a fórmula permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDeleteFormula}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete OP */}
      <AlertDialog open={!!deleteOpId} onOpenChange={(o) => !o && setDeleteOpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de produção?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação remove a OP permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDeleteOp}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormulaCard({
  formula,
  isExpanded,
  onToggle,
  onEdit,
  onApprove,
  onObsolete,
  onDelete,
  onAddItem,
  onDeleteItem,
}: {
  formula: Formula;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onObsolete: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onDeleteItem: (id: number) => void;
}) {
  const detailQ = useGetFormula(formula.id, { query: { enabled: isExpanded } as any });
  const detail = detailQ.data as FormulaDetail | undefined;

  return (
    <Card className={`transition-all ${isExpanded ? "border-primary/50" : ""}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button className="flex items-center gap-2 text-left flex-1 min-w-0" onClick={onToggle}>
            <ChevronRight className={`size-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{formula.productName}</span>
                <span className="text-xs text-muted-foreground">v{formula.version}</span>
                <FormulaBadge status={formula.status} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Rendimento: {parseFloat(formula.batchYield || "0").toLocaleString("pt-BR")} {formula.unit}
                {formula.approvedBy && ` · Aprovada por ${formula.approvedBy}`}
              </div>
            </div>
          </button>
          <div className="flex items-center gap-1 flex-shrink-0">
            {formula.status === "draft" && (
              <>
                <Button variant="ghost" size="icon" className="size-7" title="Editar" onClick={onEdit}><Pencil className="size-3.5" /></Button>
                <Button variant="ghost" size="icon" className="size-7 text-emerald-600" title="Aprovar" onClick={onApprove}><CheckCircle2 className="size-3.5" /></Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive" title="Excluir" onClick={onDelete}><Trash2 className="size-3.5" /></Button>
              </>
            )}
            {formula.status === "approved" && (
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" title="Tornar obsoleta" onClick={onObsolete}><Ban className="size-3.5" /></Button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {detailQ.isLoading ? (
            <div className="text-xs text-muted-foreground">Carregando componentes...</div>
          ) : (
            <>
              {formula.notes && <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">{formula.notes}</p>}
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Componentes ({detail?.items?.length ?? 0})</h4>
                {formula.status === "draft" && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAddItem}>
                    <Plus className="size-3 mr-1" />Adicionar MP
                  </Button>
                )}
              </div>
              {(detail?.items ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum componente cadastrado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Matéria-prima</TableHead>
                      <TableHead className="text-xs">Função</TableHead>
                      <TableHead className="text-xs">Quantidade</TableHead>
                      {formula.status === "draft" && <TableHead className="w-8"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail?.items ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm py-2">{item.productName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2">{item.function ? (ITEM_FUNCTION_LABEL[item.function] ?? item.function) : "—"}</TableCell>
                        <TableCell className="text-sm py-2">{parseFloat(item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 4 })} {item.unit}</TableCell>
                        {formula.status === "draft" && (
                          <TableCell className="py-2">
                            <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={() => onDeleteItem(item.id)}>
                              <Trash2 className="size-3" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function StageRow({
  stage,
  opStatus,
  onStart,
  onFinish,
}: {
  stage: ProductionStage;
  opStatus: string;
  onStart: () => void;
  onFinish: () => void;
}) {
  const canInteract = opStatus === "in_production";
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${stage.status === "done" ? "bg-emerald-500/5 border-emerald-500/20" : stage.status === "in_progress" ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/20 border-border"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{stage.sequence}. {STAGE_TYPE_LABEL[stage.stageType] ?? stage.stageType}</span>
          <StageBadge status={stage.status} />
        </div>
        {stage.operatorName && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Op: {stage.operatorName}
            {stage.equipment ? ` · ${stage.equipment}` : ""}
            {stage.qtyIn ? ` · Entrada: ${parseFloat(stage.qtyIn).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}` : ""}
            {stage.qtyOut ? ` · Saída: ${parseFloat(stage.qtyOut).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}` : ""}
            {stage.yieldPct ? ` · Rendimento: ${parseFloat(stage.yieldPct).toFixed(1)}%` : ""}
          </p>
        )}
        {stage.startedAt && (
          <p className="text-xs text-muted-foreground">
            {stage.status === "done"
              ? `Concluída em ${new Date(stage.finishedAt!).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
              : `Iniciada em ${new Date(stage.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
          </p>
        )}
      </div>
      {canInteract && (
        <div className="flex-shrink-0">
          {stage.status === "pending" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onStart}>
              <Play className="size-3 mr-1" />Iniciar
            </Button>
          )}
          {stage.status === "in_progress" && (
            <Button size="sm" className="h-7 text-xs" onClick={onFinish}>
              <CheckCircle2 className="size-3 mr-1" />Concluir
            </Button>
          )}
          {stage.status === "done" && <CheckCheck className="size-4 text-emerald-500" />}
        </div>
      )}
      {!canInteract && stage.status === "done" && <CheckCheck className="size-4 text-emerald-500 flex-shrink-0" />}
    </div>
  );
}
