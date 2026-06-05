import { useState, useMemo, useRef } from "react";
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
  useGetQualityNcr,
  useTransitionQualityNcr,
  useListCapaActions,
  useCreateCapaAction,
  useUpdateCapaAction,
  useDeleteCapaAction,
  useGetCapaDashboard,
  useListCapaEvidences,
  useDeleteCapaEvidence,
  getListCapaEvidencesQueryKey,
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
  getGetQualityNcrQueryKey,
  getListCapaActionsQueryKey,
  getGetCapaDashboardQueryKey,
} from "@workspace/api-client-react";
import type {
  QualityInspection,
  QualityNcr,
  QualityAnalysis,
  QualityAnalysisDetail,
  AnalysisParameter,
  QualityCertificate,
  CapaAction,
  CapaEvidence,
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
  Paperclip, Upload,
  XCircle, Clock, Eye, Wrench, ChevronRight, ListChecks, Search, ArrowRight,
} from "lucide-react";
import jsPDF from "jspdf";
import { PdfExportDialog, addPdfHeader, addPdfFooter } from "@/components/pdf-export-dialog";
import type { PdfSettings } from "@/components/pdf-export-dialog";

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
  status: z.enum(["open", "investigation", "action_plan", "execution", "effectiveness_check", "in_progress", "resolved", "closed"]),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  reportedBy: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  ncType: z.enum(["receiving", "production", "finished_goods", "customer", "other"]).optional(),
  origin: z.string().optional(),
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
      ncType: (editing.ncType as NcrForm["ncType"]) ?? undefined,
      origin: editing.origin ?? "",
    } : { inspectionId: "", productId: "", title: "", description: "", severity: "medium", status: "open", rootCause: "", correctiveAction: "", reportedBy: "", assignedTo: "", dueDate: "", origin: "" },
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
      ncType: data.ncType || null,
      origin: data.origin || null,
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
                    <SelectItem value="investigation">Investigação</SelectItem>
                    <SelectItem value="action_plan">Plano de Ação</SelectItem>
                    <SelectItem value="execution">Execução</SelectItem>
                    <SelectItem value="effectiveness_check">Verificação</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="resolved">Resolvida</SelectItem>
                    <SelectItem value="closed">Fechada</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo de NC</label>
              <Controller control={form.control} name="ncType" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || undefined)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Nenhum —</SelectItem>
                    <SelectItem value="receiving">Recebimento</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                    <SelectItem value="finished_goods">Produto acabado</SelectItem>
                    <SelectItem value="customer">Cliente</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1"><label className="text-sm font-medium">Origem</label><Input {...form.register("origin")} placeholder="Ex: Fornecedor XYZ" /></div>
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

// ─── CAPA Status helpers ──────────────────────────────────────────────────────

const CAPA_STEPS = [
  { key: "open",               label: "Aberta" },
  { key: "investigation",      label: "Investigação" },
  { key: "action_plan",        label: "Plano de Ação" },
  { key: "execution",          label: "Execução" },
  { key: "effectiveness_check",label: "Verificação" },
  { key: "closed",             label: "Encerrada" },
];

function capaStepIndex(status: string) {
  const i = CAPA_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

const CAPA_NEXT: Record<string, string> = {
  open:                "investigation",
  investigation:       "action_plan",
  action_plan:         "execution",
  execution:           "effectiveness_check",
  effectiveness_check: "closed",
};

const CAPA_NEXT_LABEL: Record<string, string> = {
  open:                "Iniciar Investigação",
  investigation:       "Enviar para Plano de Ação",
  action_plan:         "Iniciar Execução",
  execution:           "Verificar Eficácia",
  effectiveness_check: "Encerrar CAPA",
};

function ncTypeLabel(t: string | null | undefined) {
  if (!t) return "—";
  return { receiving: "Recebimento", production: "Produção", finished_goods: "Produto acabado", customer: "Cliente", other: "Outro" }[t] ?? t;
}

function actionTypeLabel(t: string) {
  return t === "corrective" ? "Corretiva" : "Preventiva";
}

function actionStatusBadge(s: string) {
  const map: Record<string, string> = { pending: "bg-slate-100 text-slate-700", in_progress: "bg-blue-100 text-blue-700", done: "bg-green-100 text-green-700", overdue: "bg-red-100 text-red-700" };
  const labelMap: Record<string, string> = { pending: "Pendente", in_progress: "Em andamento", done: "Concluída", overdue: "Atrasada" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] ?? "bg-slate-100 text-slate-700"}`}>{labelMap[s] ?? s}</span>;
}

// ─── CAPA Action Form (inline) ────────────────────────────────────────────────

const capaActionSchema = z.object({
  actionType: z.enum(["corrective", "preventive"]),
  description: z.string().min(1, "Obrigatório"),
  responsible: z.string().optional(),
  dueDate: z.string().optional(),
  evidence: z.string().optional(),
  notes: z.string().optional(),
});
type CapaActionForm = z.infer<typeof capaActionSchema>;

function CapaEvidenceSection({ actionId }: { actionId: number }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const { data: evidences = [] } = useListCapaEvidences(actionId, { query: { enabled: !!actionId } as any });
  const deleteM = useDeleteCapaEvidence();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadErr("Arquivo deve ter no máximo 5 MB"); return; }
    setUploading(true);
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/qualidade/capa/actions/${actionId}/evidence`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setUploadErr((err as any).error ?? "Erro no upload"); return; }
      qc.invalidateQueries({ queryKey: getListCapaEvidencesQueryKey(actionId) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const fmtSize = (bytes: number | null | undefined) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Arquivos de evidência</label>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />
          {uploading ? "Enviando…" : "Anexar arquivo"}
        </Button>
        <input ref={fileRef} type="file" className="hidden" accept="*/*" onChange={handleUpload} />
      </div>
      {uploadErr && <p className="text-xs text-destructive">{uploadErr}</p>}
      {evidences.length > 0 ? (
        <div className="border rounded-md divide-y">
          {evidences.map((ev: CapaEvidence) => (
            <div key={ev.id} className="flex items-center gap-2 px-3 py-2">
              <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
              <a
                href={`/api/qualidade/capa/evidence/${ev.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline truncate flex-1"
              >{ev.fileName}</a>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtSize(ev.fileSizeBytes)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive"
                onClick={() => deleteM.mutate({ id: ev.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListCapaEvidencesQueryKey(actionId) }) })}
              ><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Nenhum arquivo anexado.</p>
      )}
    </div>
  );
}

function CapaActionDialog({
  open, onClose, ncrId, editing,
}: {
  open: boolean; onClose: () => void; ncrId: number; editing?: CapaAction | null;
}) {
  const qc = useQueryClient();
  const createM = useCreateCapaAction();
  const updateM = useUpdateCapaAction();
  const form = useForm<CapaActionForm>({
    resolver: zodResolver(capaActionSchema),
    values: editing ? {
      actionType: editing.actionType as CapaActionForm["actionType"],
      description: editing.description,
      responsible: editing.responsible ?? "",
      dueDate: editing.dueDate ?? "",
      evidence: editing.evidence ?? "",
      notes: editing.notes ?? "",
    } : { actionType: "corrective", description: "", responsible: "", dueDate: "", evidence: "", notes: "" },
  });
  const onSubmit = form.handleSubmit((data) => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: getListCapaActionsQueryKey(ncrId) });
      qc.invalidateQueries({ queryKey: getGetQualityNcrQueryKey(ncrId) });
    };
    const payload = { ...data, responsible: data.responsible || null, dueDate: data.dueDate || null, evidence: data.evidence || null, notes: data.notes || null };
    if (editing) {
      updateM.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createM.mutate({ id: ncrId, data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar Ação CAPA" : "Nova Ação CAPA"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo *</label>
            <Controller control={form.control} name="actionType" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrective">Corretiva</SelectItem>
                  <SelectItem value="preventive">Preventiva</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição da ação *</label>
            <Textarea {...form.register("description")} rows={3} placeholder="Descreva a ação a ser tomada…" />
            {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium">Responsável</label><Input {...form.register("responsible")} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Prazo</label><Input {...form.register("dueDate")} type="date" /></div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Evidência de conclusão (texto)</label>
            <Textarea {...form.register("evidence")} rows={2} placeholder="Descreva a evidência da conclusão (relatório, medição, foto referência…)" />
          </div>
          <div className="space-y-1"><label className="text-sm font-medium">Observações</label><Input {...form.register("notes")} /></div>
          {editing && <CapaEvidenceSection actionId={editing.id} />}
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending || updateM.isPending}>{createM.isPending || updateM.isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── NCR CAPA Detail Dialog ───────────────────────────────────────────────────

function NcrCapaDialog({ ncrId, open, onClose }: { ncrId: number | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [capaTab, setCapaTab] = useState("investigation");
  const [actionDialog, setActionDialog] = useState(false);
  const [editingAction, setEditingAction] = useState<CapaAction | null>(null);
  const [deleteAction, setDeleteAction] = useState<CapaAction | null>(null);
  const [completeAction, setCompleteAction] = useState<CapaAction | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Investigation fields
  const [whyAnalysis, setWhyAnalysis] = useState("");
  const [ishikawaCategories, setIshikawaCategories] = useState("");
  const [investigatedBy, setInvestigatedBy] = useState("");
  // Verification fields
  const [verifiedBy, setVerifiedBy] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [closedBy, setClosedBy] = useState("");

  const { data: ncr, isLoading } = useGetQualityNcr(ncrId ?? 0, { query: { enabled: !!ncrId } as any });
  const { data: actions = [], isLoading: actionsLoading } = useListCapaActions(ncrId ?? 0, { query: { enabled: !!ncrId } as any });

  const transitionM = useTransitionQualityNcr();
  const updateCapaM = useUpdateCapaAction();
  const deleteCapaM = useDeleteCapaAction();

  const invalidateAll = () => {
    if (!ncrId) return;
    qc.invalidateQueries({ queryKey: getGetQualityNcrQueryKey(ncrId) });
    qc.invalidateQueries({ queryKey: getListCapaActionsQueryKey(ncrId) });
    qc.invalidateQueries({ queryKey: getListQualityNcrsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetQualidadeDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCapaDashboardQueryKey() });
  };

  // Sync local state when NCR data loads
  const ncrStatus = ncr?.status ?? "open";
  const stepIdx = capaStepIndex(ncrStatus);
  const nextStatus = CAPA_NEXT[ncrStatus];

  const handleTransition = (toStatus: string, extra?: object) => {
    if (!ncrId) return;
    transitionM.mutate({ id: ncrId, data: { toStatus, ...extra } as any }, {
      onSuccess: () => { invalidateAll(); },
    });
  };

  const handleCompleteAction = (action: CapaAction) => {
    updateCapaM.mutate({
      id: action.id,
      data: {
        actionType: action.actionType,
        description: action.description,
        responsible: action.responsible ?? undefined,
        dueDate: action.dueDate ?? undefined,
        evidence: action.evidence ?? undefined,
        notes: action.notes ?? undefined,
        status: "done",
      },
    }, {
      onSuccess: () => {
        if (ncrId) qc.invalidateQueries({ queryKey: getListCapaActionsQueryKey(ncrId) });
      },
    });
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Workflow CAPA — NCR #{ncrId}
              {ncr && <span className="text-sm font-normal text-muted-foreground truncate max-w-[300px]">{ncr.title}</span>}
            </DialogTitle>
          </DialogHeader>

          {isLoading && <div className="py-10 text-center text-muted-foreground">Carregando…</div>}

          {!isLoading && ncr && (
            <div className="space-y-4">
              {/* Status Stepper */}
              <div className="flex items-center gap-0 overflow-x-auto pb-1">
                {CAPA_STEPS.map((step, i) => (
                  <div key={step.key} className="flex items-center shrink-0">
                    <div className={`flex flex-col items-center gap-0.5 ${i <= stepIdx ? "text-primary" : "text-muted-foreground"}`}>
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${i < stepIdx ? "bg-primary border-primary text-primary-foreground" : i === stepIdx ? "border-primary text-primary bg-primary/10" : "border-muted bg-transparent"}`}>
                        {i < stepIdx ? <CheckCheck className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <span className="text-[10px] leading-tight whitespace-nowrap">{step.label}</span>
                    </div>
                    {i < CAPA_STEPS.length - 1 && (
                      <div className={`h-0.5 w-8 mx-1 mt-[-10px] ${i < stepIdx ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>

              {/* NCR Info row */}
              <div className="grid grid-cols-3 gap-3 text-sm border rounded-lg p-3 bg-muted/30">
                <div><span className="text-muted-foreground text-xs">Severidade</span><br /><StatusBadge status={ncr.severity} /></div>
                <div><span className="text-muted-foreground text-xs">Tipo</span><br /><span className="font-medium">{ncTypeLabel(ncr.ncType)}</span></div>
                <div><span className="text-muted-foreground text-xs">Responsável</span><br /><span className="font-medium">{ncr.assignedTo ?? "—"}</span></div>
              </div>

              {/* Tabs */}
              <Tabs value={capaTab} onValueChange={setCapaTab}>
                <TabsList>
                  <TabsTrigger value="investigation">Investigação</TabsTrigger>
                  <TabsTrigger value="actions">
                    Plano de Ação
                    {actions.filter((a) => a.status !== "done").length > 0 && (
                      <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5">{actions.filter((a) => a.status !== "done").length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="verification">Verificação / Encerramento</TabsTrigger>
                </TabsList>

                {/* ── Investigation tab ── */}
                <TabsContent value="investigation" className="space-y-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">5 Porquês (análise de causa raiz)</label>
                    <Textarea
                      rows={5}
                      placeholder={"Por quê 1: …\nPor quê 2: …\nPor quê 3: …\nPor quê 4: …\nPor quê 5: …"}
                      defaultValue={ncr.whyAnalysis ?? ""}
                      onChange={(e) => setWhyAnalysis(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Descreva cada nível de causa em linha separada</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Diagrama de Ishikawa — categorias afetadas</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {["Método", "Máquina", "Mão de obra", "Material", "Meio ambiente", "Medição"].map((cat) => {
                        const isSelected = (ishikawaCategories || ncr.ishikawaCategories || "").split(",").map((s) => s.trim()).includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              const current = (ishikawaCategories || ncr.ishikawaCategories || "").split(",").map((s) => s.trim()).filter(Boolean);
                              const next = isSelected ? current.filter((c) => c !== cat) : [...current, cat];
                              setIshikawaCategories(next.join(", "));
                            }}
                            className={`text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/60 border-border"}`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                    {(ishikawaCategories || ncr.ishikawaCategories) && (
                      <p className="text-xs text-muted-foreground">Selecionadas: {ishikawaCategories || ncr.ishikawaCategories}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Investigado por</label>
                    <Input defaultValue={ncr.investigatedBy ?? ""} onChange={(e) => setInvestigatedBy(e.target.value)} placeholder="Nome do responsável pela investigação" />
                  </div>
                  {ncrStatus !== "closed" && ncrStatus !== "resolved" && (
                    <div className="flex justify-end pt-1">
                      <Button
                        disabled={transitionM.isPending}
                        onClick={() => handleTransition(nextStatus ?? "investigation", {
                          whyAnalysis: whyAnalysis || ncr.whyAnalysis,
                          ishikawaCategories: ishikawaCategories || ncr.ishikawaCategories,
                          investigatedBy: investigatedBy || ncr.investigatedBy,
                        })}
                      >
                        {transitionM.isPending ? "Salvando…" : (CAPA_NEXT_LABEL[ncrStatus] ?? "Avançar")}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* ── Action Plan tab ── */}
                <TabsContent value="actions" className="space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{actions.length} ação(ões) cadastrada(s)</p>
                    <Button size="sm" onClick={() => { setEditingAction(null); setActionDialog(true); }}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Ação
                    </Button>
                  </div>
                  {actionsLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
                  {!actionsLoading && actions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                      <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhuma ação cadastrada ainda</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {actions.map((action) => (
                      <div key={action.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{actionTypeLabel(action.actionType)}</Badge>
                              {actionStatusBadge(action.status)}
                            </div>
                            <p className="text-sm font-medium mt-1">{action.description}</p>
                            {action.responsible && <p className="text-xs text-muted-foreground">Responsável: {action.responsible}</p>}
                            {action.dueDate && <p className="text-xs text-muted-foreground">Prazo: {fmtDate(action.dueDate)}</p>}
                            {action.completedAt && <p className="text-xs text-green-600">Concluída em {fmtDateTime(action.completedAt)}</p>}
                            {action.notes && <p className="text-xs text-muted-foreground italic">{action.notes}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {action.status !== "done" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Concluir" onClick={() => handleCompleteAction(action)}>
                                <CheckCheck className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => { setEditingAction(action); setActionDialog(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => setDeleteAction(action)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {ncrStatus === "action_plan" && actions.length > 0 && (
                    <div className="flex justify-end pt-1">
                      <Button disabled={transitionM.isPending} onClick={() => handleTransition("execution")}>
                        {transitionM.isPending ? "Salvando…" : "Iniciar Execução"}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                  {ncrStatus === "execution" && actions.every((a) => a.status === "done") && (
                    <div className="flex justify-end pt-1">
                      <Button disabled={transitionM.isPending} onClick={() => handleTransition("effectiveness_check")}>
                        {transitionM.isPending ? "Salvando…" : "Verificar Eficácia"}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* ── Verification / Closure tab ── */}
                <TabsContent value="verification" className="space-y-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Verificado por</label>
                    <Input defaultValue={ncr.verifiedBy ?? ""} onChange={(e) => setVerifiedBy(e.target.value)} placeholder="Responsável pela verificação de eficácia" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Notas de verificação</label>
                    <Textarea rows={3} defaultValue={ncr.verificationNotes ?? ""} onChange={(e) => setVerificationNotes(e.target.value)} placeholder="Descreva como foi feita a verificação de eficácia…" />
                  </div>
                  {ncr.verifiedAt && <p className="text-xs text-green-600">Verificado em {fmtDateTime(ncr.verifiedAt)}</p>}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Encerrado por</label>
                    <Input defaultValue={ncr.closedBy ?? ""} onChange={(e) => setClosedBy(e.target.value)} placeholder="Responsável pelo encerramento" />
                  </div>
                  {ncr.closedAt && <p className="text-xs text-green-600">Encerrado em {fmtDateTime(ncr.closedAt)}</p>}
                  {ncrStatus !== "closed" && ncrStatus !== "resolved" && (
                    <div className="flex justify-end gap-2 pt-1">
                      {ncrStatus === "effectiveness_check" && (
                        <Button
                          disabled={transitionM.isPending}
                          onClick={() => handleTransition("closed", {
                            verifiedBy: verifiedBy || ncr.verifiedBy,
                            verificationNotes: verificationNotes || ncr.verificationNotes,
                            closedBy: closedBy || ncr.closedBy,
                          })}
                        >
                          {transitionM.isPending ? "Salvando…" : "Encerrar CAPA"}
                          <CheckCircle2 className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  )}
                  {(ncrStatus === "closed" || ncrStatus === "resolved") && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      <p className="text-sm text-green-800 font-medium">CAPA encerrada com sucesso.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* PDF Export Button */}
              <div className="flex justify-end border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportingPdf}
                  onClick={() => {
                    setExportingPdf(true);
                    try {
                      const doc = new jsPDF();
                      const lm = 14;
                      let y = 15;
                      const addLine = (text: string, indent = 0, bold = false) => {
                        if (y > 275) { doc.addPage(); y = 15; }
                        if (bold) doc.setFont("helvetica", "bold");
                        doc.text(text, lm + indent, y);
                        doc.setFont("helvetica", "normal");
                        y += 7;
                      };
                      const addSection = (title: string) => {
                        y += 3;
                        doc.setFontSize(11);
                        addLine(title, 0, true);
                        doc.setFontSize(10);
                        y += 1;
                      };
                      doc.setFontSize(14);
                      addLine(`Relatório CAPA — NCR #${ncr?.id}`, 0, true);
                      doc.setFontSize(10);
                      addLine(`Título: ${ncr?.title ?? ""}`, 0);
                      addLine(`Status: ${ncrStatus}  |  Severidade: ${ncr?.severity ?? ""}  |  Tipo: ${ncTypeLabel(ncr?.ncType)}`);
                      addLine(`Produto: ${ncr?.productName ?? "—"}  |  Responsável: ${ncr?.assignedTo ?? "—"}`);
                      addLine(`Criada em: ${fmtDate(ncr?.createdAt)}  |  Prazo: ${ncr?.dueDate ? fmtDate(ncr.dueDate) : "—"}`);
                      if (ncr?.origin) addLine(`Origem: ${ncr.origin}`);

                      addSection("1. Descrição da Não Conformidade");
                      if (ncr?.description) {
                        doc.text(doc.splitTextToSize(ncr.description, 180), lm, y);
                        y += Math.ceil(ncr.description.length / 90) * 6 + 3;
                      } else { addLine("—"); }

                      addSection("2. Análise de Causa Raiz (5 Porquês)");
                      const whys = (ncr?.whyAnalysis ?? "—").split("\n");
                      whys.forEach((w) => { if (y > 275) { doc.addPage(); y = 15; } doc.text(doc.splitTextToSize(w || "—", 176), lm + 4, y); y += 6; });

                      addSection("3. Categorias Ishikawa");
                      addLine(ncr?.ishikawaCategories ?? "—", 4);

                      addSection("4. Plano de Ação CAPA");
                      if (actions.length === 0) {
                        addLine("Nenhuma ação cadastrada.", 4);
                      } else {
                        actions.forEach((a, i) => {
                          addLine(`${i + 1}. [${a.actionType === "corrective" ? "Corretiva" : "Preventiva"}] ${a.description}`, 4, a.status === "done");
                          addLine(`   Responsável: ${a.responsible ?? "—"}  |  Prazo: ${a.dueDate ? fmtDate(a.dueDate) : "—"}  |  Status: ${a.status}`, 4);
                          if (a.evidence) { addLine(`   Evidência: ${a.evidence}`, 4); }
                        });
                      }

                      addSection("5. Verificação de Eficácia");
                      addLine(`Verificado por: ${ncr?.verifiedBy ?? "—"}`, 4);
                      if (ncr?.verificationNotes) {
                        doc.text(doc.splitTextToSize(ncr.verificationNotes, 176), lm + 4, y); y += Math.ceil(ncr.verificationNotes.length / 90) * 6 + 3;
                      }

                      addSection("6. Encerramento");
                      addLine(`Encerrado por: ${ncr?.closedBy ?? "—"}  |  Data: ${ncr?.closedAt ? fmtDateTime(ncr.closedAt) : "—"}`, 4);

                      doc.save(`CAPA-NCR${ncr?.id}-${new Date().toISOString().slice(0, 10)}.pdf`);
                    } finally {
                      setExportingPdf(false);
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  {exportingPdf ? "Gerando…" : "Exportar Relatório CAPA (PDF)"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action sub-dialogs */}
      {ncrId && (
        <CapaActionDialog open={actionDialog} onClose={() => { setActionDialog(false); setEditingAction(null); }} ncrId={ncrId} editing={editingAction} />
      )}

      <AlertDialog open={!!deleteAction} onOpenChange={(v) => !v && setDeleteAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ação CAPA?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação será excluída permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteAction || !ncrId) return;
                deleteCapaM.mutate({ id: deleteAction.id }, {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: getListCapaActionsQueryKey(ncrId) });
                    setDeleteAction(null);
                  },
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const [capaDialogNcrId, setCapaDialogNcrId] = useState<number | null>(null);

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
  const { data: capaDashboard } = useGetCapaDashboard();
  const { data: productsPage } = useListProducts({ pageSize: 500 });
  const products = productsPage?.items ?? [];
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

  async function handleExportPdf(settings: PdfSettings) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const lm = 14, rm = 196;

    const subtitle = `Taxa de aprovação: ${approvalRate}% · Inspeções: ${inspections.length} · NCRs: ${ncrs.length} · Análises: ${analyses.length}`;
    let y = addPdfHeader(doc, settings, "Relatório de Qualidade", subtitle);

    const drawSectionHeader = (title: string) => {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setFillColor("#334155");
      doc.rect(lm, y, rm - lm, 7, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor("#ffffff");
      doc.text(title, lm + 2, y + 5);
      y += 9;
    };

    const drawTableHeader = (headers: string[], colX: number[]) => {
      doc.setFillColor("#e2e8f0");
      doc.rect(lm, y, rm - lm, 6, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor("#000000");
      headers.forEach((h, i) => doc.text(h, colX[i] + 1, y + 4.5));
      y += 6;
    };

    // ── Inspeções ──
    drawSectionHeader(`Inspeções (${filteredInspections.length})`);
    const inspHeaders = ["Produto", "Lote", "Inspetor", "Data", "Resultado"];
    const inspColX = [lm, lm + 45, lm + 90, lm + 130, lm + 158];
    drawTableHeader(inspHeaders, inspColX);
    doc.setFont("helvetica", "normal");
    let rowBg = false;
    for (const ins of filteredInspections) {
      if (y > 272) {
        doc.addPage(); y = 14;
        drawTableHeader(inspHeaders, inspColX);
        doc.setFont("helvetica", "normal");
        rowBg = false;
      }
      if (rowBg) { doc.setFillColor("#f8fafc"); doc.rect(lm, y, rm - lm, 6, "F"); }
      rowBg = !rowBg;
      doc.setFontSize(7.5);
      doc.setTextColor("#000000");
      const prodTxt = (ins.productName ?? "—").slice(0, 25);
      doc.text(prodTxt, inspColX[0] + 1, y + 4.5);
      doc.text((ins.batchNumber ?? "—").slice(0, 20), inspColX[1] + 1, y + 4.5);
      doc.text((ins.inspector ?? "—").slice(0, 20), inspColX[2] + 1, y + 4.5);
      doc.text(fmtDate(ins.inspectionDate), inspColX[3] + 1, y + 4.5);
      const resultMap: Record<string, string> = { approved: "Aprovado", rejected: "Reprovado", pending: "Pendente" };
      doc.setTextColor(ins.result === "approved" ? "#166534" : ins.result === "rejected" ? "#991b1b" : "#78350f");
      doc.text(resultMap[ins.result] ?? ins.result, inspColX[4] + 1, y + 4.5);
      doc.setDrawColor("#e2e8f0");
      doc.line(lm, y + 6, rm, y + 6);
      y += 6;
    }

    y += 6;

    // ── NCRs ──
    drawSectionHeader(`Não Conformidades — NCRs (${filteredNcrs.length})`);
    const ncrHeaders = ["Título", "Produto", "Severidade", "Status", "Responsável", "Prazo"];
    const ncrColX = [lm, lm + 50, lm + 95, lm + 120, lm + 148, lm + 173];
    drawTableHeader(ncrHeaders, ncrColX);
    doc.setFont("helvetica", "normal");
    rowBg = false;
    for (const ncr of filteredNcrs) {
      if (y > 272) {
        doc.addPage(); y = 14;
        drawTableHeader(ncrHeaders, ncrColX);
        doc.setFont("helvetica", "normal");
        rowBg = false;
      }
      if (rowBg) { doc.setFillColor("#f8fafc"); doc.rect(lm, y, rm - lm, 6, "F"); }
      rowBg = !rowBg;
      doc.setFontSize(7.5);
      doc.setTextColor("#000000");
      doc.text(ncr.title.slice(0, 28), ncrColX[0] + 1, y + 4.5);
      doc.text((ncr.productName ?? "—").slice(0, 22), ncrColX[1] + 1, y + 4.5);
      const sevMap: Record<string, string> = { critical: "Crítica", high: "Alta", medium: "Média", low: "Baixa" };
      doc.setTextColor(ncr.severity === "critical" ? "#991b1b" : ncr.severity === "high" ? "#c2410c" : "#000000");
      doc.text(sevMap[ncr.severity] ?? ncr.severity, ncrColX[2] + 1, y + 4.5);
      doc.setTextColor("#000000");
      doc.text((ncr.status ?? "—").slice(0, 14), ncrColX[3] + 1, y + 4.5);
      doc.text((ncr.assignedTo ?? "—").slice(0, 14), ncrColX[4] + 1, y + 4.5);
      doc.text(ncr.dueDate ? fmtDate(ncr.dueDate) : "—", ncrColX[5] + 1, y + 4.5);
      doc.setDrawColor("#e2e8f0");
      doc.line(lm, y + 6, rm, y + 6);
      y += 6;
    }

    y += 6;

    // ── Análises CQ ──
    drawSectionHeader(`Análises CQ (${filteredAnalyses.length})`);
    const anHeaders = ["Código", "Produto", "Tipo", "Analista", "Status", "Conclusão"];
    const anColX = [lm, lm + 35, lm + 80, lm + 110, lm + 140, lm + 162];
    drawTableHeader(anHeaders, anColX);
    doc.setFont("helvetica", "normal");
    rowBg = false;
    for (const an of filteredAnalyses) {
      if (y > 272) {
        doc.addPage(); y = 14;
        drawTableHeader(anHeaders, anColX);
        doc.setFont("helvetica", "normal");
        rowBg = false;
      }
      if (rowBg) { doc.setFillColor("#f8fafc"); doc.rect(lm, y, rm - lm, 6, "F"); }
      rowBg = !rowBg;
      doc.setFontSize(7.5);
      doc.setTextColor("#000000");
      doc.text(an.sampleCode.slice(0, 16), anColX[0] + 1, y + 4.5);
      doc.text((an.productName ?? "—").slice(0, 22), anColX[1] + 1, y + 4.5);
      doc.text(analysisTypeLabel(an.analysisType).slice(0, 16), anColX[2] + 1, y + 4.5);
      doc.text((an.analystName ?? "—").slice(0, 16), anColX[3] + 1, y + 4.5);
      doc.setTextColor(an.status === "approved" ? "#166534" : an.status === "rejected" ? "#991b1b" : "#000000");
      doc.text(analysisStatusLabel(an.status).slice(0, 14), anColX[4] + 1, y + 4.5);
      doc.setTextColor("#000000");
      doc.text(an.completedAt ? fmtDate(an.completedAt) : "—", anColX[5] + 1, y + 4.5);
      doc.setDrawColor("#e2e8f0");
      doc.line(lm, y + 6, rm, y + 6);
      y += 6;
    }

    addPdfFooter(doc, settings);
    doc.save(`relatorio-qualidade-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Controle de Qualidade"
          subtitle="Análises, inspeções, laudos e não conformidades"
          actions={<PdfExportDialog onExport={handleExportPdf} />}
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

            {/* Supplier quality ranking */}
            {(dashboard?.supplierQuality ?? []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    Taxa de aprovação CQ por fornecedor
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Aprovadas</TableHead>
                        <TableHead className="text-right">Reprovadas</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                        <TableHead className="w-44">Barra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(dashboard?.supplierQuality ?? []).map((s) => (
                        <TableRow key={s.supplierId}>
                          <TableCell className="font-medium text-sm">{s.supplierName}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-green-600 font-semibold">{s.approvedCount}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-destructive font-semibold">{s.rejectedCount}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums font-semibold">
                            <span className={s.approvalRate >= 90 ? "text-green-600" : s.approvalRate >= 70 ? "text-yellow-600" : "text-destructive"}>
                              {s.approvalRate}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${s.approvalRate >= 90 ? "bg-green-500" : s.approvalRate >= 70 ? "bg-yellow-400" : "bg-destructive"}`}
                                style={{ width: `${Math.min(s.approvalRate, 100)}%` }}
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
            {/* CAPA Dashboard KPIs */}
            {capaDashboard && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">CAPA — Ações Corretivas e Preventivas</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className={(capaDashboard.totalOpen ?? 0) > 0 ? "cursor-pointer hover:border-amber-400 transition-colors" : ""} onClick={() => { if ((capaDashboard.totalOpen ?? 0) > 0) { setNcrStatusFilter("all"); setActiveTab("ncrs"); } }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">NCRs CAPA em aberto</CardTitle>
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-semibold ${(capaDashboard.totalOpen ?? 0) > 0 ? "text-amber-600" : ""}`}>{capaDashboard.totalOpen ?? 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">{capaDashboard.totalClosed ?? 0} encerradas</p>
                    </CardContent>
                  </Card>
                  <Card className={(capaDashboard.overdueActionsCount ?? 0) > 0 ? "border-red-300" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Ações atrasadas</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-semibold ${(capaDashboard.overdueActionsCount ?? 0) > 0 ? "text-destructive" : ""}`}>{capaDashboard.overdueActionsCount ?? 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">{capaDashboard.openActionsCount ?? 0} pendentes no total</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Prazo médio encerramento</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{capaDashboard.avgClosureDays != null ? `${Math.round(capaDashboard.avgClosureDays)}d` : "—"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Da abertura ao encerramento</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">NCRs atrasadas</CardTitle>
                      <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-semibold ${(capaDashboard.overdueNcrsCount ?? 0) > 0 ? "text-destructive" : ""}`}>{capaDashboard.overdueNcrsCount ?? 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">Com prazo vencido e ainda abertas</p>
                    </CardContent>
                  </Card>
                  <Card className={(capaDashboard.recurrenceCount ?? 0) > 0 ? "border-orange-300" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Reincidência</CardTitle>
                      <AlertTriangle className={`h-4 w-4 ${(capaDashboard.recurrenceCount ?? 0) > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-semibold ${(capaDashboard.recurrenceCount ?? 0) > 0 ? "text-orange-600" : ""}`}>
                        {(capaDashboard.recurrenceRate as number | undefined) != null ? `${capaDashboard.recurrenceRate}%` : "0%"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{capaDashboard.recurrenceCount ?? 0} produto(s) com múltiplas NCRs</p>
                    </CardContent>
                  </Card>
                </div>
                {/* Origin breakdown */}
                {Object.keys(capaDashboard.byOrigin ?? {}).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">NCRs por Origem</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(capaDashboard.byOrigin ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([origin, count]) => (
                          <div key={origin} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-sm">
                            <span className="font-medium">{origin}</span>
                            <Badge variant="secondary" className="h-4 text-xs">{count as number}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {(capaDashboard.upcomingActions ?? []).length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-primary" />
                        Próximas ações CAPA a vencer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead>Prazo</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(capaDashboard.upcomingActions ?? []).map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="text-sm font-medium max-w-[250px] truncate">{a.description}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{a.actionType === "corrective" ? "Corretiva" : "Preventiva"}</Badge></TableCell>
                              <TableCell className="text-sm text-muted-foreground">{a.responsible ?? "—"}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">{a.dueDate ? fmtDate(a.dueDate) : "—"}</TableCell>
                              <TableCell>{actionStatusBadge(a.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
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
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="investigation">Investigação</SelectItem>
                    <SelectItem value="action_plan">Plano de Ação</SelectItem>
                    <SelectItem value="execution">Execução</SelectItem>
                    <SelectItem value="effectiveness_check">Verificação</SelectItem>
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" title="Workflow CAPA" onClick={() => setCapaDialogNcrId(ncr.id)}>
                              <Wrench className="h-4 w-4" />
                            </Button>
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

      <NcrCapaDialog ncrId={capaDialogNcrId} open={!!capaDialogNcrId} onClose={() => setCapaDialogNcrId(null)} />

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
