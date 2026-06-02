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
  useListProductLots,
  useListQualityAnalyses,
  useCreateQualityAnalysis,
  useUpdateQualityAnalysis,
  useDeleteQualityAnalysis,
  useGetQualityAnalysis,
  useStartQualityAnalysis,
  useCompleteQualityAnalysis,
  useAddAnalysisParameter,
  useUpdateAnalysisParameter,
  useDeleteAnalysisParameter,
  useListQualityCertificates,
  getListQualityInspectionsQueryKey,
  getListQualityNcrsQueryKey,
  getGetQualidadeDashboardQueryKey,
  getListQualityAnalysesQueryKey,
  getGetQualityAnalysisQueryKey,
  getListQualityCertificatesQueryKey,
} from "@workspace/api-client-react";
import type {
  QualityInspection,
  QualityNcr,
  QualityAnalysis,
  QualityAnalysisDetail,
  AnalysisParameter,
  QualityCertificate,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  AlertTriangle, CheckCheck, FlaskConical, Download, Play, CheckCircle2,
  XCircle, Clock, Eye,
} from "lucide-react";
import jsPDF from "jspdf";

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
function hoursInQueue(createdAt: string | Date | null | undefined) {
  if (!createdAt) return 0;
  return Math.round((Date.now() - new Date(createdAt).getTime()) / 3600000);
}
function analysisTypeLabel(t: string) {
  const map: Record<string, string> = {
    physical_chemical: "Físico-Química",
    microbiological: "Microbiológica",
    organoleptic: "Organoléptica",
    full: "Completa",
  };
  return map[t] ?? t;
}
function analysisStatusLabel(s: string) {
  const map: Record<string, string> = {
    pending: "Pendente",
    in_analysis: "Em Análise",
    approved: "Aprovada",
    rejected: "Reprovada",
  };
  return map[s] ?? s;
}

// ─── PDF Laudo ────────────────────────────────────────────────────────────────

function generateLaudo(analysis: QualityAnalysisDetail) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const lm = 20, rm = 190, cw = rm - lm;
  let y = 18;

  const line = (a: number, b: number) => { doc.line(a, y, b, y); y += 3; };
  const br = (n = 4) => { y += n; };
  const txt = (s: string, x = lm, fontSize = 10, bold = false, color = "#000000") => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color);
    doc.text(s, x, y);
  };

  // Header
  doc.setFillColor("#1e3a5f");
  doc.rect(lm, 10, cw, 14, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#ffffff");
  doc.text("LAUDO DE ANÁLISE — CONTROLE DE QUALIDADE", lm + 4, 19);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("NEXUS ERP — Sistema de Gestão Industrial", lm + 4, 24);
  y = 32;

  // Status banner
  const isApproved = analysis.status === "approved";
  doc.setFillColor(isApproved ? "#dcfce7" : "#fee2e2");
  doc.rect(lm, y, cw, 10, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(isApproved ? "#166534" : "#991b1b");
  doc.text(isApproved ? "✓  AMOSTRA APROVADA" : "✗  AMOSTRA REPROVADA", lm + 4, y + 7);
  y += 14;

  // Info grid
  doc.setTextColor("#000000");
  doc.setFontSize(9);

  const row2 = (label1: string, val1: string, label2: string, val2: string) => {
    doc.setFont("helvetica", "bold"); doc.text(label1, lm, y); doc.setFont("helvetica", "normal"); doc.text(val1, lm + 38, y);
    doc.setFont("helvetica", "bold"); doc.text(label2, rm / 2 + 5, y); doc.setFont("helvetica", "normal"); doc.text(val2, rm / 2 + 43, y);
    y += 6;
  };

  row2("Código da Amostra:", analysis.sampleCode, "Tipo de Análise:", analysisTypeLabel(analysis.analysisType));
  row2("Produto:", analysis.productName ?? "—", "Lote Interno:", analysis.internalLot ?? "—");
  row2("Analista:", analysis.analystName, "Revisor:", analysis.reviewerName ?? "—");
  row2("Início:", fmtDateTime(analysis.startedAt), "Conclusão:", fmtDateTime(analysis.completedAt));
  if (analysis.justification) {
    doc.setFont("helvetica", "bold"); doc.text("Justificativa:", lm, y);
    doc.setFont("helvetica", "normal");
    const justLines = doc.splitTextToSize(analysis.justification, cw - 40);
    doc.text(justLines, lm + 38, y);
    y += Math.max(6, justLines.length * 5);
  }

  br(4);
  doc.setDrawColor("#94a3b8");
  line(lm, rm);

  // Parameters table
  txt("PARÂMETROS ANALISADOS", lm, 10, true);
  br(5);

  if (analysis.parameters && analysis.parameters.length > 0) {
    // Table header
    doc.setFillColor("#f1f5f9");
    doc.rect(lm, y - 4, cw, 8, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#334155");
    doc.text("Parâmetro", lm + 1, y);
    doc.text("Especificação", lm + 55, y);
    doc.text("Mín.", lm + 100, y);
    doc.text("Máx.", lm + 120, y);
    doc.text("Resultado", lm + 140, y);
    doc.text("Un.", lm + 160, y);
    doc.text("Status", lm + 173, y);
    y += 5;
    doc.setDrawColor("#e2e8f0");
    line(lm, rm);

    doc.setFont("helvetica", "normal");
    doc.setTextColor("#000000");

    for (const p of analysis.parameters) {
      const status = p.isConforming === true ? "Conforme" : p.isConforming === false ? "Não Conf." : "Pendente";
      const statusColor = p.isConforming === true ? "#166534" : p.isConforming === false ? "#991b1b" : "#92400e";
      doc.setFontSize(8);
      doc.text(String(p.parameterName).substring(0, 28), lm + 1, y);
      doc.text(String(p.specification ?? "—").substring(0, 20), lm + 55, y);
      doc.text(p.minValue ?? "—", lm + 100, y);
      doc.text(p.maxValue ?? "—", lm + 120, y);
      doc.text(p.resultValue ?? "—", lm + 140, y);
      doc.text(p.unit ?? "—", lm + 160, y);
      doc.setTextColor(statusColor);
      doc.text(status, lm + 173, y);
      doc.setTextColor("#000000");
      y += 6;
      doc.setDrawColor("#f1f5f9");
      line(lm, rm);
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor("#64748b");
    doc.text("Nenhum parâmetro registrado.", lm, y);
    y += 8;
  }

  br(6);
  doc.setDrawColor("#94a3b8");
  line(lm, rm);

  // Notes
  if (analysis.notes) {
    txt("OBSERVAÇÕES", lm, 9, true);
    br(5);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(analysis.notes, cw);
    doc.text(noteLines, lm, y);
    y += noteLines.length * 5 + 4;
  }

  // Signatures
  br(6);
  const sigY = y;
  doc.line(lm, sigY, lm + 65, sigY);
  doc.line(rm - 65, sigY, rm, sigY);
  br(4);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Analista: ${analysis.analystName}`, lm, y);
  doc.text(`Revisor: ${analysis.reviewerName ?? "—"}`, rm - 65, y);
  br(10);

  // Footer
  const now = new Date().toLocaleString("pt-BR");
  doc.setFontSize(7.5);
  doc.setTextColor("#64748b");
  doc.text(`Gerado em ${now} — NEXUS ERP`, lm, 285);
  doc.text(`Laudo #${analysis.id} — ${analysis.sampleCode}`, rm, 285, { align: "right" });

  doc.save(`laudo-${analysis.sampleCode}-${analysis.id}.pdf`);
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
  open: boolean; onClose: () => void; editing?: QualityInspection | null;
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
    values: editing ? {
      productId: editing.productId ? String(editing.productId) : "",
      batchNumber: editing.batchNumber ?? "",
      inspectionDate: editing.inspectionDate,
      inspector: editing.inspector,
      result: editing.result as "approved" | "rejected" | "conditional",
      quantityInspected: String(editing.quantityInspected),
      quantityFailed: String(editing.quantityFailed),
      notes: editing.notes ?? "",
    } : { productId: "", batchNumber: "", inspectionDate: todayStr(), inspector: "", result: "approved", quantityInspected: "0", quantityFailed: "0", notes: "" },
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
        <DialogHeader><DialogTitle>{editing ? "Editar Inspeção" : "Nova Inspeção"}</DialogTitle></DialogHeader>
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
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>
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
              <label className="text-sm font-medium">Data *</label>
              <Input {...form.register("inspectionDate")} type="date" />
              {form.formState.errors.inspectionDate && <p className="text-xs text-destructive">{form.formState.errors.inspectionDate.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Inspetor *</label>
              <Input {...form.register("inspector")} placeholder="Nome" />
              {form.formState.errors.inspector && <p className="text-xs text-destructive">{form.formState.errors.inspector.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Resultado *</label>
            <Controller control={form.control} name="result" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="conditional">Condicional</SelectItem>
                  <SelectItem value="rejected">Reprovado</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Qtd. inspecionada</label>
              <Input {...form.register("quantityInspected")} type="number" min="0" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Qtd. com defeito</label>
              <Input {...form.register("quantityFailed")} type="number" min="0" />
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
  open: boolean; onClose: () => void; editing?: QualityNcr | null;
  products: Array<{ id: number; name: string }>; inspections: QualityInspection[];
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
    values: editing ? {
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
    } : { inspectionId: "", productId: "", title: "", description: "", severity: "medium", status: "open", rootCause: "", correctiveAction: "", reportedBy: "", assignedTo: "", dueDate: "" },
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
        <DialogHeader><DialogTitle>{editing ? "Editar NCR" : "Nova Não Conformidade"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Título *</label>
            <Input {...form.register("title")} placeholder="Descrição curta" />
            {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Produto</label>
              <Controller control={form.control} name="productId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Nenhum —</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Inspeção</label>
              <Controller control={form.control} name="inspectionId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Nenhuma —</SelectItem>
                    {inspections.slice(0, 20).map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>#{i.id} — {i.inspectionDate}</SelectItem>
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
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
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
          <div className="space-y-1"><label className="text-sm font-medium">Descrição</label><Input {...form.register("description")} /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Causa raiz</label><Input {...form.register("rootCause")} /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Ação corretiva</label><Input {...form.register("correctiveAction")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium">Reportado por</label><Input {...form.register("reportedBy")} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Responsável</label><Input {...form.register("assignedTo")} /></div>
          </div>
          <div className="space-y-1"><label className="text-sm font-medium">Prazo</label><Input {...form.register("dueDate")} type="date" /></div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Analysis Dialog (create / edit) ─────────────────────────────────────────

const analysisSchema = z.object({
  lotId: z.string().optional(),
  sampleCode: z.string().min(1, "Obrigatório"),
  analysisType: z.enum(["physical_chemical", "microbiological", "organoleptic", "full"]),
  analystName: z.string().min(1, "Obrigatório"),
  reviewerName: z.string().optional(),
  productId: z.string().optional(),
  internalLot: z.string().optional(),
  notes: z.string().optional(),
});
type AnalysisForm = z.infer<typeof analysisSchema>;

function AnalysisDialog({
  open, onClose, editing, products,
}: {
  open: boolean; onClose: () => void; editing?: QualityAnalysis | null;
  products: Array<{ id: number; name: string; sku?: string | null }>;
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListQualityAnalysesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
  };
  const createM = useCreateQualityAnalysis();
  const updateM = useUpdateQualityAnalysis();

  // FIX #1: Fetch quarantine lots to populate lot selector
  const { data: allLots = [] } = useListProductLots({});
  const quarantineLots = useMemo(
    () => allLots.filter((l) => l.cqStatus === "quarantine"),
    [allLots]
  );

  const form = useForm<AnalysisForm>({
    resolver: zodResolver(analysisSchema),
    values: editing ? {
      lotId: editing.lotId ? String(editing.lotId) : "none",
      sampleCode: editing.sampleCode,
      analysisType: editing.analysisType as AnalysisForm["analysisType"],
      analystName: editing.analystName,
      reviewerName: editing.reviewerName ?? "",
      productId: editing.productId ? String(editing.productId) : "none",
      internalLot: editing.internalLot ?? "",
      notes: editing.notes ?? "",
    } : {
      lotId: "none",
      sampleCode: `AM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      analysisType: "physical_chemical",
      analystName: "",
      reviewerName: "",
      productId: "none",
      internalLot: "",
      notes: "",
    },
  });

  // When lot is selected, auto-populate product and internalLot fields
  const watchedLotId = form.watch("lotId");
  useMemo(() => {
    if (!watchedLotId || watchedLotId === "none") return;
    const lot = allLots.find((l) => String(l.id) === watchedLotId);
    if (!lot) return;
    if (lot.internalLot) form.setValue("internalLot", lot.internalLot);
    if (lot.productId) form.setValue("productId", String(lot.productId));
  }, [watchedLotId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      lotId: data.lotId && data.lotId !== "none" ? parseInt(data.lotId) : null,
      sampleCode: data.sampleCode,
      analysisType: data.analysisType,
      analystName: data.analystName,
      reviewerName: data.reviewerName || null,
      productId: data.productId && data.productId !== "none" ? parseInt(data.productId) : null,
      internalLot: data.internalLot || null,
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
        <DialogHeader><DialogTitle>{editing ? "Editar Análise" : "Nova Análise CQ"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          {/* Lot selector — primary field for quarantine lot release */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Lote em Quarentena</label>
            <Controller control={form.control} name="lotId" render={({ field }) => (
              <Select value={field.value ?? "none"} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Selecionar lote (opcional)…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum lote vinculado —</SelectItem>
                  {quarantineLots.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.internalLot} — {products.find((p) => p.id === l.productId)?.name ?? `Produto #${l.productId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
            <p className="text-xs text-muted-foreground">Lotes em quarentena aguardando liberação CQ</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Código da Amostra *</label>
              <Input {...form.register("sampleCode")} placeholder="AM-2025-0001" />
              {form.formState.errors.sampleCode && <p className="text-xs text-destructive">{form.formState.errors.sampleCode.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo de Análise</label>
              <Controller control={form.control} name="analysisType" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical_chemical">Físico-Química</SelectItem>
                    <SelectItem value="microbiological">Microbiológica</SelectItem>
                    <SelectItem value="organoleptic">Organoléptica</SelectItem>
                    <SelectItem value="full">Completa</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Produto</label>
              <Controller control={form.control} name="productId" render={({ field }) => (
                <Select value={field.value ?? "none"} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Lote Interno</label>
              <Input {...form.register("internalLot")} placeholder="LOT-2025-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Analista *</label>
              <Input {...form.register("analystName")} placeholder="Nome do analista" />
              {form.formState.errors.analystName && <p className="text-xs text-destructive">{form.formState.errors.analystName.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Revisor</label>
              <Input {...form.register("reviewerName")} placeholder="Nome do revisor" />
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

// ─── Analysis Detail Dialog ────────────────────────────────────────────────────

const parameterSchema = z.object({
  parameterName: z.string().min(1, "Obrigatório"),
  specification: z.string().optional(),
  minValue: z.string().optional(),
  maxValue: z.string().optional(),
  resultValue: z.string().optional(),
  unit: z.string().optional(),
  isConforming: z.string().optional(), // "true" | "false" | "" (sentinel)
});
type ParameterForm = z.infer<typeof parameterSchema>;

function AnalysisDetailDialog({
  analysisId, open, onClose, onComplete,
}: {
  analysisId: number | null; open: boolean; onClose: () => void;
  onComplete: (analysis: QualityAnalysisDetail) => void;
}) {
  const qc = useQueryClient();
  const [editingParam, setEditingParam] = useState<AnalysisParameter | null>(null);
  const [paramDialogOpen, setParamDialogOpen] = useState(false);
  const [deleteParamId, setDeleteParamId] = useState<number | null>(null);

  const invalidateAll = () => {
    if (analysisId) qc.invalidateQueries({ queryKey: getGetQualityAnalysisQueryKey(analysisId) });
    qc.invalidateQueries({ queryKey: getListQualityAnalysesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
  };

  const { data: analysis, isLoading } = useGetQualityAnalysis(analysisId ?? 0, {
    query: { enabled: !!analysisId && open } as any,
  });

  const startM = useStartQualityAnalysis();
  const addParamM = useAddAnalysisParameter();
  const updateParamM = useUpdateAnalysisParameter();
  const deleteParamM = useDeleteAnalysisParameter();

  const paramForm = useForm<ParameterForm>({
    resolver: zodResolver(parameterSchema),
    values: editingParam ? {
      parameterName: editingParam.parameterName,
      specification: editingParam.specification ?? "",
      minValue: editingParam.minValue ?? "",
      maxValue: editingParam.maxValue ?? "",
      resultValue: editingParam.resultValue ?? "",
      unit: editingParam.unit ?? "",
      isConforming: editingParam.isConforming === true ? "true" : editingParam.isConforming === false ? "false" : "",
    } : { parameterName: "", specification: "", minValue: "", maxValue: "", resultValue: "", unit: "", isConforming: "" },
  });

  const handleParamSubmit = paramForm.handleSubmit((data) => {
    const payload = {
      parameterName: data.parameterName,
      specification: data.specification || null,
      minValue: data.minValue || null,
      maxValue: data.maxValue || null,
      resultValue: data.resultValue || null,
      unit: data.unit || null,
      isConforming: data.isConforming === "true" ? true : data.isConforming === "false" ? false : null,
    };
    if (editingParam) {
      updateParamM.mutate(
        { parameterId: editingParam.id, data: payload },
        { onSuccess: () => { invalidateAll(); setParamDialogOpen(false); setEditingParam(null); paramForm.reset(); } }
      );
    } else if (analysisId) {
      addParamM.mutate(
        { id: analysisId, data: payload },
        { onSuccess: () => { invalidateAll(); setParamDialogOpen(false); paramForm.reset(); } }
      );
    }
  });

  if (!open || !analysisId) return null;

  const canEdit = analysis && ["pending", "in_analysis"].includes(analysis.status);
  const canStart = analysis?.status === "pending";
  const canComplete = analysis && ["pending", "in_analysis"].includes(analysis.status);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Análise {analysis?.sampleCode ?? `#${analysisId}`}
            </DialogTitle>
          </DialogHeader>

          {isLoading && <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>}

          {analysis && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{analysisTypeLabel(analysis.analysisType)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{analysisStatusLabel(analysis.status)}</span></div>
                <div><span className="text-muted-foreground">Produto:</span> <span className="font-medium">{analysis.productName ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Lote:</span> <span className="font-mono text-xs font-medium">{analysis.internalLot ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Analista:</span> <span className="font-medium">{analysis.analystName}</span></div>
                <div><span className="text-muted-foreground">Revisor:</span> <span className="font-medium">{analysis.reviewerName ?? "—"}</span></div>
                {analysis.startedAt && <div><span className="text-muted-foreground">Início:</span> <span className="font-medium">{fmtDateTime(analysis.startedAt)}</span></div>}
                {analysis.completedAt && <div><span className="text-muted-foreground">Conclusão:</span> <span className="font-medium">{fmtDateTime(analysis.completedAt)}</span></div>}
                {analysis.justification && <div className="col-span-2"><span className="text-muted-foreground">Justificativa:</span> <span className="font-medium">{analysis.justification}</span></div>}
                {analysis.notes && <div className="col-span-2"><span className="text-muted-foreground">Observações:</span> <span className="font-medium">{analysis.notes}</span></div>}
              </div>

              {/* Parameters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Parâmetros Analisados</h3>
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => { setEditingParam(null); paramForm.reset(); setParamDialogOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Parâmetro
                    </Button>
                  )}
                </div>

                {(analysis.parameters ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">Nenhum parâmetro registrado ainda</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parâmetro</TableHead>
                          <TableHead>Especificação</TableHead>
                          <TableHead className="text-right">Mín.</TableHead>
                          <TableHead className="text-right">Máx.</TableHead>
                          <TableHead className="text-right">Resultado</TableHead>
                          <TableHead>Un.</TableHead>
                          <TableHead>Status</TableHead>
                          {canEdit && <TableHead className="text-right">Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(analysis.parameters ?? []).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium text-sm">{p.parameterName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.specification ?? "—"}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{p.minValue ?? "—"}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{p.maxValue ?? "—"}</TableCell>
                            <TableCell className={`text-right text-sm tabular-nums font-semibold ${p.isConforming === false ? "text-destructive" : p.isConforming === true ? "text-green-600" : ""}`}>
                              {p.resultValue ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.unit ?? "—"}</TableCell>
                            <TableCell>
                              {p.isConforming === true && <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Conforme</Badge>}
                              {p.isConforming === false && <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Não Conf.</Badge>}
                              {p.isConforming === null && <Badge variant="secondary" className="text-xs">Pendente</Badge>}
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingParam(p); setParamDialogOpen(true); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteParamId(p.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Actions */}
              <DialogFooter className="flex flex-wrap gap-2 pt-2">
                {analysis.status !== "pending" && analysis.status !== "in_analysis" && (
                  <Button variant="outline" onClick={() => generateLaudo(analysis as QualityAnalysisDetail)}>
                    <Download className="h-4 w-4 mr-2" /> Baixar Laudo (PDF)
                  </Button>
                )}
                {canStart && (
                  <Button variant="outline" onClick={() => startM.mutate({ id: analysisId }, { onSuccess: () => invalidateAll() })} disabled={startM.isPending}>
                    <Play className="h-4 w-4 mr-2" /> Iniciar Análise
                  </Button>
                )}
                {canComplete && (
                  <Button onClick={() => { onComplete(analysis as QualityAnalysisDetail); onClose(); }}>
                    <CheckCheck className="h-4 w-4 mr-2" /> Finalizar Análise
                  </Button>
                )}
                <Button variant="outline" onClick={onClose}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Parameter dialog */}
      <Dialog open={paramDialogOpen} onOpenChange={(v) => { if (!v) { setParamDialogOpen(false); setEditingParam(null); paramForm.reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingParam ? "Editar Parâmetro" : "Novo Parâmetro"}</DialogTitle></DialogHeader>
          <form onSubmit={handleParamSubmit} className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome do Parâmetro *</label>
              <Input {...paramForm.register("parameterName")} placeholder="Ex: Teor de Princípio Ativo" />
              {paramForm.formState.errors.parameterName && <p className="text-xs text-destructive">{paramForm.formState.errors.parameterName.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Especificação</label>
              <Input {...paramForm.register("specification")} placeholder="Ex: 97,0% — 103,0%" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Mínimo</label>
                <Input {...paramForm.register("minValue")} placeholder="97.0" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Máximo</label>
                <Input {...paramForm.register("maxValue")} placeholder="103.0" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Unidade</label>
                <Input {...paramForm.register("unit")} placeholder="%" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Resultado</label>
                <Input {...paramForm.register("resultValue")} placeholder="99.5" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Conformidade</label>
                <Controller control={paramForm.control} name="isConforming" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Automático…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Automático</SelectItem>
                      <SelectItem value="true">Conforme</SelectItem>
                      <SelectItem value="false">Não Conforme</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setParamDialogOpen(false); setEditingParam(null); paramForm.reset(); }}>Cancelar</Button>
              <Button type="submit" disabled={addParamM.isPending || updateParamM.isPending}>
                {(addParamM.isPending || updateParamM.isPending) ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete param confirm */}
      <AlertDialog open={!!deleteParamId} onOpenChange={(v) => !v && setDeleteParamId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir parâmetro?</AlertDialogTitle>
            <AlertDialogDescription>Este parâmetro será removido permanentemente da análise.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteParamM.mutate({ parameterId: deleteParamId! }, {
                  onSuccess: () => { invalidateAll(); setDeleteParamId(null); },
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Complete Analysis Dialog ──────────────────────────────────────────────────

function CompleteAnalysisDialog({
  analysis, open, onClose,
}: {
  analysis: QualityAnalysisDetail | null; open: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [result, setResult] = useState<"approved" | "rejected">("approved");
  const [reviewerName, setReviewerName] = useState("");
  const [justification, setJustification] = useState("");
  const completeM = useCompleteQualityAnalysis();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListQualityAnalysesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListQualityNcrsQueryKey() });
    if (analysis) qc.invalidateQueries({ queryKey: getGetQualityAnalysisQueryKey(analysis.id) });
  };

  const handleSubmit = () => {
    if (!analysis) return;
    completeM.mutate(
      { id: analysis.id, data: { result, reviewerName: reviewerName || null, justification: justification || null } },
      {
        onSuccess: (completed) => {
          invalidateAll();
          // Auto-download laudo after completion
          generateLaudo(completed as QualityAnalysisDetail);
          onClose();
        },
      }
    );
  };

  if (!open || !analysis) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Análise — {analysis.sampleCode}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Resultado *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setResult("approved")}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  result === "approved"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-border hover:border-green-300"
                }`}
              >
                <CheckCircle2 className="h-5 w-5 text-green-500" /> Aprovada
              </button>
              <button
                type="button"
                onClick={() => setResult("rejected")}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  result === "rejected"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-border hover:border-red-300"
                }`}
              >
                <XCircle className="h-5 w-5 text-red-500" /> Reprovada
              </button>
            </div>
            {result === "rejected" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                Uma NCR será criada automaticamente ao reprovar este lote.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Revisor</label>
            <Input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="Nome do revisor" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Justificativa / Parecer</label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva o parecer final ou motivo de reprovação…"
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Após finalizar, o laudo PDF será gerado automaticamente para download.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={completeM.isPending}
            className={result === "rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {completeM.isPending ? "Salvando…" : `Confirmar — ${result === "approved" ? "Aprovada" : "Reprovada"}`}
          </Button>
        </DialogFooter>
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

  // Analysis state
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState("all");
  const [analysisDialog, setAnalysisDialog] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState<QualityAnalysis | null>(null);
  const [detailAnalysisId, setDetailAnalysisId] = useState<number | null>(null);
  const [completeAnalysis, setCompleteAnalysis] = useState<QualityAnalysisDetail | null>(null);
  const [deleteAnalysis, setDeleteAnalysis] = useState<QualityAnalysis | null>(null);

  // Certificates state
  const [certSearch, setCertSearch] = useState("");

  const { data: inspections = [], isLoading: inspLoading } = useListQualityInspections({});
  const { data: ncrs = [], isLoading: ncrsLoading } = useListQualityNcrs({});
  const { data: dashboard } = useGetQualidadeDashboard();
  const { data: products = [] } = useListProducts({});
  const { data: analyses = [], isLoading: analysesLoading } = useListQualityAnalyses({});
  const { data: certificates = [], isLoading: certsLoading } = useListQualityCertificates();

  const deleteInspMutation = useDeleteQualityInspection();
  const deleteNcrMutation = useDeleteQualityNcr();
  const resolveNcrMutation = useResolveQualityNcr();
  const deleteAnalysisMutation = useDeleteQualityAnalysis();

  const activeProducts = useMemo(() => products.filter((p) => p.active === "true"), [products]);

  const filteredInspections = useMemo(() => {
    let list = inspections;
    if (inspResultFilter !== "all") list = list.filter((i) => i.result === inspResultFilter);
    if (inspSearch) {
      const q = inspSearch.toLowerCase();
      list = list.filter((i) =>
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
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        (n.productName ?? "").toLowerCase().includes(q) ||
        (n.reportedBy ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [ncrs, ncrStatusFilter, ncrSeverityFilter, ncrSearch]);

  const filteredAnalyses = useMemo(() => {
    let list = analyses;
    if (analysisStatusFilter !== "all") list = list.filter((a) => a.status === analysisStatusFilter);
    if (analysisSearch) {
      const q = analysisSearch.toLowerCase();
      list = list.filter((a) =>
        a.sampleCode.toLowerCase().includes(q) ||
        (a.productName ?? "").toLowerCase().includes(q) ||
        (a.analystName ?? "").toLowerCase().includes(q) ||
        (a.internalLot ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [analyses, analysisStatusFilter, analysisSearch]);

  const approvalRate = dashboard?.approvalRate ?? 0;

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Controle de Qualidade"
          subtitle="Análises, inspeções, laudos e não conformidades"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analyses">
              Análises CQ
              {(dashboard?.pendingAnalysesCount ?? 0) + (dashboard?.inAnalysisCount ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 font-semibold">
                  {(dashboard?.pendingAnalysesCount ?? 0) + (dashboard?.inAnalysisCount ?? 0)}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="certificates">Certificados</TabsTrigger>
            <TabsTrigger value="inspections">Inspeções</TabsTrigger>
            <TabsTrigger value="ncrs">Não Conformidades</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            {/* Row 1: Inspections + NCRs */}
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
                    {(dashboard?.criticalNcrsCount ?? 0) > 0 ? "Atenção imediata" : "Nenhuma crítica"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Analysis KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card
                className={(dashboard?.pendingAnalysesCount ?? 0) > 0 ? "cursor-pointer hover:border-amber-400 transition-colors" : ""}
                onClick={() => { if ((dashboard?.pendingAnalysesCount ?? 0) > 0) { setAnalysisStatusFilter("pending"); setActiveTab("analyses"); } }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Análises pendentes</CardTitle>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${(dashboard?.pendingAnalysesCount ?? 0) > 0 ? "text-amber-600" : ""}`}>
                    {dashboard?.pendingAnalysesCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Aguardando análise</p>
                </CardContent>
              </Card>
              <Card
                className={(dashboard?.inAnalysisCount ?? 0) > 0 ? "cursor-pointer hover:border-blue-400 transition-colors" : ""}
                onClick={() => { if ((dashboard?.inAnalysisCount ?? 0) > 0) { setAnalysisStatusFilter("in_analysis"); setActiveTab("analyses"); } }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Em análise</CardTitle>
                  <FlaskConical className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${(dashboard?.inAnalysisCount ?? 0) > 0 ? "text-blue-600" : ""}`}>
                    {dashboard?.inAnalysisCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Em laboratório</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Taxa aprovação (análises)</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${(dashboard?.analysisApprovalRate ?? 0) >= 90 ? "text-green-600" : (dashboard?.analysisApprovalRate ?? 0) >= 70 ? "text-yellow-600" : "text-destructive"}`}>
                    {dashboard?.analysisApprovalRate ?? 0}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Laudos emitidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tempo médio análise</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{dashboard?.avgAnalysisDaysStr ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Criação até conclusão</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recent analyses */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Análises recentes</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => { setEditingAnalysis(null); setAnalysisDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nova
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {(dashboard?.recentAnalyses ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">Nenhuma análise registrada</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Amostra</TableHead>
                          <TableHead>Produto / Lote</TableHead>
                          <TableHead>Analista</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dashboard?.recentAnalyses ?? []).map((a) => (
                          <TableRow key={a.id} className="cursor-pointer" onClick={() => setDetailAnalysisId(a.id)}>
                            <TableCell className="text-sm font-mono font-medium">{a.sampleCode}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{a.productName ?? "—"}</div>
                              {a.internalLot && <div className="text-xs text-muted-foreground">{a.internalLot}</div>}
                            </TableCell>
                            <TableCell className="text-sm">{a.analystName}</TableCell>
                            <TableCell>
                              <Badge
                                variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {analysisStatusLabel(a.status)}
                              </Badge>
                            </TableCell>
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
                          {ncr.productName && <span className="text-xs text-muted-foreground">{ncr.productName}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {ncr.dueDate && <p className="text-xs text-muted-foreground">Prazo: {fmtDate(ncr.dueDate)}</p>}
                        <Button variant="ghost" size="sm" className="text-xs h-7 mt-1 text-green-700" onClick={() => setResolveNcr(ncr)}>
                          <CheckCheck className="h-3.5 w-3.5 mr-1" /> Resolver
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* FIX #4: Top rejected parameters panel */}
            {(dashboard?.topRejectedParameters ?? []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Parâmetros com maior índice de reprovação
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parâmetro</TableHead>
                        <TableHead className="text-right">Reprovações</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                        <TableHead className="w-48">Barra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(dashboard?.topRejectedParameters ?? []).map((p) => (
                        <TableRow key={p.parameterName}>
                          <TableCell className="font-medium text-sm">{p.parameterName}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-destructive font-semibold">{p.rejectCount}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{p.totalCount}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums font-semibold">
                            <span className={p.rejectionRate >= 50 ? "text-destructive" : p.rejectionRate >= 25 ? "text-amber-600" : "text-yellow-600"}>
                              {p.rejectionRate}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${p.rejectionRate >= 50 ? "bg-destructive" : p.rejectionRate >= 25 ? "bg-amber-500" : "bg-yellow-400"}`}
                                style={{ width: `${Math.min(p.rejectionRate, 100)}%` }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── ANALYSES TAB ──────────────────────────────────────────────── */}
          <TabsContent value="analyses" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <Input
                  className="w-52"
                  placeholder="Buscar amostra, produto, analista…"
                  value={analysisSearch}
                  onChange={(e) => setAnalysisSearch(e.target.value)}
                />
                <Select value={analysisStatusFilter} onValueChange={setAnalysisStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_analysis">Em Análise</SelectItem>
                    <SelectItem value="approved">Aprovada</SelectItem>
                    <SelectItem value="rejected">Reprovada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { setEditingAnalysis(null); setAnalysisDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nova Análise
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amostra</TableHead>
                      <TableHead>Produto / Lote</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Analista</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Na fila</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysesLoading && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!analysesLoading && filteredAnalyses.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Nenhuma análise encontrada</TableCell></TableRow>
                    )}
                    {filteredAnalyses.map((a) => {
                      const hrs = hoursInQueue(a.createdAt);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="font-mono text-sm font-medium">{a.sampleCode}</div>
                            <div className="text-xs text-muted-foreground">#{a.id}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{a.productName ?? "—"}</div>
                            {a.internalLot && <div className="text-xs text-muted-foreground font-mono">{a.internalLot}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{analysisTypeLabel(a.analysisType)}</TableCell>
                          <TableCell className="text-sm">{a.analystName}</TableCell>
                          <TableCell>
                            <Badge
                              variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}
                              className={`text-xs ${a.status === "in_analysis" ? "bg-blue-100 text-blue-800 border-blue-200" : a.status === "pending" ? "bg-amber-100 text-amber-800 border-amber-200" : ""}`}
                            >
                              {analysisStatusLabel(a.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {a.status === "pending" || a.status === "in_analysis" ? (
                              <span className={hrs > 48 ? "text-destructive font-medium" : hrs > 24 ? "text-amber-600" : ""}>
                                {hrs}h
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhes" onClick={() => setDetailAnalysisId(a.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setEditingAnalysis(a); setAnalysisDialog(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir" onClick={() => setDeleteAnalysis(a)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
                    {inspLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>}
                    {!inspLoading && filteredInspections.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhuma inspeção encontrada</TableCell></TableRow>}
                    {filteredInspections.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(i.inspectionDate)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{i.productName ?? "—"}</div>
                          {i.batchNumber && <div className="text-xs text-muted-foreground font-mono">{i.batchNumber}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{i.inspector}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{i.quantityInspected}</TableCell>
                        <TableCell className={`text-right text-sm tabular-nums font-medium ${i.quantityFailed > 0 ? "text-destructive" : "text-muted-foreground"}`}>{i.quantityFailed}</TableCell>
                        <TableCell><StatusBadge status={i.result} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{i.notes ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingInsp(i); setInspDialog(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteInsp(i)}>
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

          {/* ── CERTIFICATES TAB ──────────────────────────────────────────── */}
          <TabsContent value="certificates" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <Input
                className="w-64"
                placeholder="Buscar certificado, produto, analista…"
                value={certSearch}
                onChange={(e) => setCertSearch(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">{certificates.length} certificado{certificates.length !== 1 ? "s" : ""} emitido{certificates.length !== 1 ? "s" : ""}</p>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Certificado</TableHead>
                      <TableHead>Amostra</TableHead>
                      <TableHead>Produto / Lote</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Analista</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead className="text-right">Laudo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certsLoading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!certsLoading && certificates.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhum certificado emitido ainda</TableCell></TableRow>
                    )}
                    {certificates
                      .filter((c) => {
                        if (!certSearch) return true;
                        const q = certSearch.toLowerCase();
                        return (
                          c.certificateNumber.toLowerCase().includes(q) ||
                          c.sampleCode.toLowerCase().includes(q) ||
                          (c.productName ?? "").toLowerCase().includes(q) ||
                          (c.internalLot ?? "").toLowerCase().includes(q) ||
                          c.analystName.toLowerCase().includes(q)
                        );
                      })
                      .map((cert) => (
                        <TableRow key={cert.id}>
                          <TableCell className="font-mono text-sm font-medium">{cert.certificateNumber}</TableCell>
                          <TableCell className="text-sm font-medium">{cert.sampleCode}</TableCell>
                          <TableCell>
                            <div className="text-sm">{cert.productName ?? "—"}</div>
                            {cert.internalLot && <div className="text-xs text-muted-foreground">{cert.internalLot}</div>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{analysisTypeLabel(cert.analysisType)}</TableCell>
                          <TableCell>
                            <Badge variant={cert.result === "approved" ? "default" : "destructive"} className="text-xs">
                              {cert.result === "approved" ? "Aprovado" : "Reprovado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{cert.analystName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(cert.issuedAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Baixar laudo"
                              onClick={() => {
                                if (!cert.parametersSnapshot) return;
                                let params: AnalysisParameter[] = [];
                                try { params = JSON.parse(cert.parametersSnapshot); } catch { /* ignore */ }
                                generateLaudo({
                                  id: cert.analysisId ?? 0,
                                  sampleCode: cert.sampleCode,
                                  analysisType: cert.analysisType as QualityAnalysisDetail["analysisType"],
                                  status: cert.result as QualityAnalysisDetail["status"],
                                  analystName: cert.analystName,
                                  reviewerName: cert.reviewerName ?? null,
                                  justification: cert.justification ?? null,
                                  productId: cert.productId ?? null,
                                  productName: cert.productName ?? null,
                                  internalLot: cert.internalLot ?? null,
                                  lotId: null,
                                  notes: null,
                                  startedAt: null,
                                  completedAt: cert.issuedAt,
                                  createdAt: cert.createdAt,
                                  updatedAt: cert.createdAt,
                                  parameters: params,
                                });
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
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
                    {ncrsLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>}
                    {!ncrsLoading && filteredNcrs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhuma NCR encontrada</TableCell></TableRow>}
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
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{ncr.dueDate ? fmtDate(ncr.dueDate) : "—"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {(ncr.status === "open" || ncr.status === "in_progress") && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" title="Resolver" onClick={() => setResolveNcr(ncr)}>
                                <CheckCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingNcr(ncr); setNcrDialog(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteNcr(ncr)}>
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

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      <InspectionDialog open={inspDialog} onClose={() => { setInspDialog(false); setEditingInsp(null); }} editing={editingInsp} products={activeProducts} />

      <NcrDialog open={ncrDialog} onClose={() => { setNcrDialog(false); setEditingNcr(null); }} editing={editingNcr} products={activeProducts} inspections={inspections} />

      <AnalysisDialog open={analysisDialog} onClose={() => { setAnalysisDialog(false); setEditingAnalysis(null); }} editing={editingAnalysis} products={activeProducts} />

      <AnalysisDetailDialog
        analysisId={detailAnalysisId}
        open={!!detailAnalysisId}
        onClose={() => setDetailAnalysisId(null)}
        onComplete={(a) => { setDetailAnalysisId(null); setCompleteAnalysis(a); }}
      />

      <CompleteAnalysisDialog
        analysis={completeAnalysis}
        open={!!completeAnalysis}
        onClose={() => setCompleteAnalysis(null)}
      />

      {/* Delete inspection */}
      <AlertDialog open={!!deleteInsp} onOpenChange={(v) => !v && setDeleteInsp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir inspeção?</AlertDialogTitle>
            <AlertDialogDescription>A inspeção de {fmtDate(deleteInsp?.inspectionDate)} será excluída permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteInspMutation.mutate({ id: deleteInsp!.id }, {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: getListQualityInspectionsQueryKey() });
                  qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
                  setDeleteInsp(null);
                },
              })}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete NCR */}
      <AlertDialog open={!!deleteNcr} onOpenChange={(v) => !v && setDeleteNcr(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir NCR?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteNcr?.title}" será excluída permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteNcrMutation.mutate({ id: deleteNcr!.id }, {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: getListQualityNcrsQueryKey() });
                  qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
                  setDeleteNcr(null);
                },
              })}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolve NCR */}
      <AlertDialog open={!!resolveNcr} onOpenChange={(v) => !v && setResolveNcr(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar NCR como resolvida?</AlertDialogTitle>
            <AlertDialogDescription>"{resolveNcr?.title}" será marcada como resolvida com a data atual.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resolveNcrMutation.mutate({ id: resolveNcr!.id, data: {} }, {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: getListQualityNcrsQueryKey() });
                  qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
                  setResolveNcr(null);
                },
              })}
            >Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete analysis */}
      <AlertDialog open={!!deleteAnalysis} onOpenChange={(v) => !v && setDeleteAnalysis(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
            <AlertDialogDescription>A análise "{deleteAnalysis?.sampleCode}" e todos os seus parâmetros serão excluídos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAnalysisMutation.mutate({ id: deleteAnalysis!.id }, {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: getListQualityAnalysesQueryKey() });
                  qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
                  setDeleteAnalysis(null);
                },
              })}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
