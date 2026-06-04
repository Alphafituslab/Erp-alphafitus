import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  Loader2,
  BarChart3,
  TrendingUp,
  X,
  CheckCircle2,
  Upload,
  AlertTriangle,
  FileCode,
  PackagePlus,
  Link,
  Minus,
} from "lucide-react";
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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFiscalDocuments,
  useCreateFiscalDocument,
  useUpdateFiscalDocument,
  useDeleteFiscalDocument,
  useGetFiscalTaxSummary,
  useGetFiscalDashboard,
  useConfirmNFeImport,
  getListFiscalDocumentsQueryKey,
  getGetFiscalTaxSummaryQueryKey,
  getGetFiscalDashboardQueryKey,
} from "@workspace/api-client-react";
import type { FiscalDocument, NFeParseResult, NFeImportItem } from "@workspace/api-client-react";

// ── Types & constants ─────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  nfe: "NF-e",
  nfse: "NFS-e",
  nf_entrada: "NF Entrada",
};

const STATUS_LABELS: Record<string, string> = {
  issued: "Emitida",
  cancelled: "Cancelada",
};

const DIRECTION_LABELS: Record<string, string> = {
  saida: "Saída",
  entrada: "Entrada",
};

const fmtCurrency = (v: string | null | undefined) =>
  parseFloat(v ?? "0").toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR");

// ── NF-e Import Dialog ────────────────────────────────────────────────────────

const fmtCnpj = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
};

type ItemDraft = NFeImportItem & { descriptionEdited: string };

const IMPORT_AS_LABELS: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  create: { label: "Criar produto", icon: <PackagePlus className="h-3 w-3" />, className: "text-blue-700" },
  existing: { label: "Vincular existente", icon: <Link className="h-3 w-3" />, className: "text-green-700" },
  skip: { label: "Ignorar", icon: <Minus className="h-3 w-3" />, className: "text-gray-500" },
};

function NFeImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "review">("upload");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<NFeParseResult | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [createSupplier, setCreateSupplier] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [notes, setNotes] = useState("");

  const confirmMut = useConfirmNFeImport();

  const reset = useCallback(() => {
    setStep("upload");
    setParsed(null);
    setItems([]);
    setParsing(false);
    setCreateSupplier(true);
    setNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  const parseFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast({ title: "Selecione um arquivo .xml", variant: "destructive" }); return;
    }
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/fiscal/import-xml", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast({ title: err.error ?? "Erro ao processar XML", variant: "destructive" });
        return;
      }
      const data: NFeParseResult = await resp.json();
      setParsed(data);
      setItems(data.items.map((it) => ({ ...it, descriptionEdited: it.description })));
      setCreateSupplier(!data.existingSupplierId);
      setStep("review");
    } catch {
      toast({ title: "Erro ao enviar arquivo", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  };

  const setItemField = (idx: number, field: keyof ItemDraft, value: string) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    const firstCfop = items.find((it) => it.cfop)?.cfop ?? null;
    const payload = {
      accessKey: parsed.accessKey,
      issueDate: parsed.issueDate,
      number: parsed.number,
      serie: parsed.serie,
      naturalOperation: parsed.naturalOperation,
      cfop: firstCfop,
      tpNF: parsed.tpNF ?? 0,
      emitterName: parsed.emitterName,
      emitterDocument: parsed.emitterDocument,
      emitterTradeName: parsed.emitterTradeName ?? null,
      emitterStreet: parsed.emitterStreet ?? null,
      emitterNumber: parsed.emitterNumber ?? null,
      emitterCity: parsed.emitterCity ?? null,
      emitterState: parsed.emitterState ?? null,
      emitterZip: parsed.emitterZip ?? null,
      recipientName: parsed.recipientName,
      recipientDocument: parsed.recipientDocument,
      totalNF: parsed.totalNF,
      totalICMS: parsed.totalICMS,
      totalPIS: parsed.totalPIS,
      totalCOFINS: parsed.totalCOFINS,
      xmlContent: parsed.xmlContent,
      existingSupplierId: parsed.existingSupplierId ?? null,
      createSupplier,
      notes: notes || null,
      items: items.map((it) => ({ ...it, description: it.descriptionEdited })),
    };

    try {
      await confirmMut.mutateAsync({ data: payload });
      qc.invalidateQueries({ queryKey: getListFiscalDocumentsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFiscalDashboardQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFiscalTaxSummaryQueryKey() });
      toast({ title: "NF-e importada com sucesso!" });
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao confirmar importação";
      toast({ title: msg, variant: "destructive" });
    }
  };

  const fmtNum = (v: string | null | undefined) =>
    parseFloat(v ?? "0").toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-blue-600" />
            {step === "upload" ? "Importar XML NF-e" : "Revisar Dados da NF-e"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="py-4 space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragging ? "border-blue-400 bg-blue-50" : "border-muted-foreground/30 hover:border-blue-300 hover:bg-muted/30"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {parsing ? (
                <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-3" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              )}
              <p className="text-sm font-medium">
                {parsing ? "Processando XML…" : "Arraste o arquivo XML aqui ou clique para selecionar"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Suporte para NF-e v4.00 (.xml)</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === "review" && parsed && (
          <div className="space-y-5 py-2">
            {/* Duplicate warning */}
            {parsed.duplicateAccessKey && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta NF-e já foi importada anteriormente (chave de acesso duplicada). Confirmar criará um registro duplicado.
                </AlertDescription>
              </Alert>
            )}

            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Número / Série</p>
                <p className="font-semibold">{parsed.number} / {parsed.serie}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Data de Emissão</p>
                <p className="font-semibold">{parsed.issueDate ? new Date(parsed.issueDate).toLocaleDateString("pt-BR") : "—"}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Valor Total NF</p>
                <p className="font-semibold text-green-700">{fmtNum(parsed.totalNF)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Natureza da Operação</p>
                <p className="font-semibold text-xs">{parsed.naturalOperation || "—"}</p>
              </div>
            </div>

            {/* Emitter + Recipient */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emitente</p>
                <p className="font-medium">{parsed.emitterName}</p>
                {parsed.emitterTradeName && <p className="text-xs text-muted-foreground">{parsed.emitterTradeName}</p>}
                <p className="font-mono text-xs">{fmtCnpj(parsed.emitterDocument)}</p>
                {parsed.emitterCity && <p className="text-xs text-muted-foreground">{parsed.emitterCity}/{parsed.emitterState}</p>}
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destinatário</p>
                <p className="font-medium">{parsed.recipientName}</p>
                <p className="font-mono text-xs">{fmtCnpj(parsed.recipientDocument)}</p>
              </div>
            </div>

            {/* Supplier */}
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fornecedor</p>
              {parsed.existingSupplierId ? (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Fornecedor já cadastrado (ID #{parsed.existingSupplierId})
                </div>
              ) : (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createSupplier}
                    onChange={(e) => setCreateSupplier(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  Criar novo fornecedor <span className="font-medium text-blue-700">{parsed.emitterName}</span> ({fmtCnpj(parsed.emitterDocument)}) automaticamente
                </label>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Itens da NF-e ({items.length})
              </p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs min-w-[180px]">Descrição (editável)</TableHead>
                      <TableHead className="text-xs">NCM</TableHead>
                      <TableHead className="text-xs">CFOP</TableHead>
                      <TableHead className="text-xs text-right">Qtd</TableHead>
                      <TableHead className="text-xs text-right">Un</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx} className={item.importAs === "skip" ? "opacity-40" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{item.itemNumber}</TableCell>
                        <TableCell className="text-xs font-mono">{item.supplierCode}</TableCell>
                        <TableCell>
                          <Input
                            value={item.descriptionEdited}
                            onChange={(e) => setItemField(idx, "descriptionEdited", e.target.value)}
                            className="h-7 text-xs"
                            disabled={item.importAs === "skip"}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono">{item.ncm}</TableCell>
                        <TableCell className="text-xs">{item.cfop}</TableCell>
                        <TableCell className="text-xs text-right">{parseFloat(item.quantity).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs text-right">{item.unit}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{fmtNum(item.totalPrice)}</TableCell>
                        <TableCell>
                          <Select
                            value={item.importAs}
                            onValueChange={(v) => setItemField(idx, "importAs", v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(IMPORT_AS_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>
                                  <span className={`flex items-center gap-1 ${v.className}`}>
                                    {v.icon} {v.label}
                                    {k === "existing" && item.existingProductName && (
                                      <span className="text-muted-foreground ml-1">({item.existingProductName})</span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-4 gap-3 text-sm border rounded-lg p-3 bg-muted/20">
              <div>
                <p className="text-xs text-muted-foreground">Total NF</p>
                <p className="font-semibold text-green-700">{fmtNum(parsed.totalNF)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ICMS</p>
                <p className="font-medium">{fmtNum(parsed.totalICMS)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PIS</p>
                <p className="font-medium">{fmtNum(parsed.totalPIS)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">COFINS</p>
                <p className="font-medium">{fmtNum(parsed.totalCOFINS)}</p>
              </div>
            </div>

            {/* Access key */}
            {parsed.accessKey && (
              <div className="text-xs text-muted-foreground font-mono bg-muted/30 rounded px-3 py-2 break-all">
                Chave de acesso: {parsed.accessKey}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Observações sobre esta importação..."
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "review" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {step === "review" && (
            <Button onClick={handleConfirm} disabled={confirmMut.isPending}>
              {confirmMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar Importação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Form schema ───────────────────────────────────────────────────────────────

const docSchema = z.object({
  type: z.enum(["nfe", "nfse", "nf_entrada"]),
  direction: z.enum(["saida", "entrada"]),
  number: z.string().optional(),
  emitter: z.string().min(1, "Emitente obrigatório"),
  recipient: z.string().min(1, "Destinatário obrigatório"),
  emitterDocument: z.string().optional(),
  recipientDocument: z.string().optional(),
  issueDate: z.string().min(1, "Data de emissão obrigatória"),
  totalAmount: z.string().min(1, "Valor obrigatório"),
  cfop: z.string().optional(),
  icmsAmount: z.string().optional(),
  pisAmount: z.string().optional(),
  cofinsAmount: z.string().optional(),
  issAmount: z.string().optional(),
  status: z.enum(["issued", "cancelled"]),
  referenceOrderId: z.string().optional(),
  notes: z.string().optional(),
});

type DocForm = z.infer<typeof docSchema>;

// ── Document dialog ───────────────────────────────────────────────────────────

function DocDialog({
  open,
  onClose,
  editDoc,
}: {
  open: boolean;
  onClose: () => void;
  editDoc: FiscalDocument | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const create = useCreateFiscalDocument();
  const update = useUpdateFiscalDocument();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DocForm>({
    resolver: zodResolver(docSchema),
    defaultValues: editDoc
      ? {
          type: editDoc.type as DocForm["type"],
          direction: (editDoc.direction ?? "saida") as DocForm["direction"],
          number: editDoc.number ?? "",
          emitter: editDoc.emitter,
          recipient: editDoc.recipient,
          emitterDocument: editDoc.emitterDocument ?? "",
          recipientDocument: editDoc.recipientDocument ?? "",
          issueDate: editDoc.issueDate
            ? new Date(editDoc.issueDate).toISOString().slice(0, 10)
            : "",
          totalAmount: editDoc.totalAmount,
          cfop: editDoc.cfop ?? "",
          icmsAmount: editDoc.icmsAmount ?? "",
          pisAmount: editDoc.pisAmount ?? "",
          cofinsAmount: editDoc.cofinsAmount ?? "",
          issAmount: editDoc.issAmount ?? "",
          status: editDoc.status as DocForm["status"],
          referenceOrderId: editDoc.referenceOrderId ?? "",
          notes: editDoc.notes ?? "",
        }
      : {
          type: "nfe",
          direction: "saida",
          status: "issued",
          totalAmount: "0",
          icmsAmount: "0",
          pisAmount: "0",
          cofinsAmount: "0",
          issAmount: "0",
          issueDate: new Date().toISOString().slice(0, 10),
        },
  });

  // Sync form values whenever the dialog opens or the target document changes
  useEffect(() => {
    if (!open) return;
    if (editDoc) {
      reset({
        type: editDoc.type as DocForm["type"],
        direction: (editDoc.direction ?? "saida") as DocForm["direction"],
        number: editDoc.number ?? "",
        emitter: editDoc.emitter,
        recipient: editDoc.recipient,
        emitterDocument: editDoc.emitterDocument ?? "",
        recipientDocument: editDoc.recipientDocument ?? "",
        issueDate: editDoc.issueDate
          ? new Date(editDoc.issueDate).toISOString().slice(0, 10)
          : "",
        totalAmount: editDoc.totalAmount,
        cfop: editDoc.cfop ?? "",
        icmsAmount: editDoc.icmsAmount ?? "",
        pisAmount: editDoc.pisAmount ?? "",
        cofinsAmount: editDoc.cofinsAmount ?? "",
        issAmount: editDoc.issAmount ?? "",
        status: editDoc.status as DocForm["status"],
        referenceOrderId: editDoc.referenceOrderId ?? "",
        notes: editDoc.notes ?? "",
      });
    } else {
      reset({
        type: "nfe",
        direction: "saida",
        status: "issued",
        totalAmount: "0",
        icmsAmount: "0",
        pisAmount: "0",
        cofinsAmount: "0",
        issAmount: "0",
        issueDate: new Date().toISOString().slice(0, 10),
        number: "",
        emitter: "",
        recipient: "",
        emitterDocument: "",
        recipientDocument: "",
        cfop: "",
        referenceOrderId: "",
        notes: "",
      });
    }
  }, [open, editDoc, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListFiscalDocumentsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFiscalDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFiscalTaxSummaryQueryKey() });
  };

  const onSubmit = async (data: DocForm) => {
    try {
      const payload = {
        ...data,
        issueDate: new Date(data.issueDate).toISOString(),
        totalAmount: data.totalAmount,
        icmsAmount: data.icmsAmount || "0",
        pisAmount: data.pisAmount || "0",
        cofinsAmount: data.cofinsAmount || "0",
        issAmount: data.issAmount || "0",
        number: data.number || undefined,
        emitterDocument: data.emitterDocument || undefined,
        recipientDocument: data.recipientDocument || undefined,
        cfop: data.cfop || undefined,
        referenceOrderId: data.referenceOrderId || undefined,
        notes: data.notes || undefined,
      };

      if (editDoc) {
        await update.mutateAsync({ id: editDoc.id, data: payload });
        toast({ title: "Documento atualizado" });
      } else {
        await create.mutateAsync({ data: payload });
        toast({ title: "Documento criado" });
      }
      invalidate();
      reset();
      onClose();
    } catch {
      toast({ title: "Erro ao salvar documento", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editDoc ? "Editar Documento Fiscal" : "Novo Documento Fiscal"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nfe">NF-e</SelectItem>
                      <SelectItem value="nfse">NFS-e</SelectItem>
                      <SelectItem value="nf_entrada">NF Entrada</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1">
              <Label>Direção *</Label>
              <Controller
                name="direction"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Direção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1">
              <Label>Status *</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="issued">Emitida</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Número da NF</Label>
              <Input {...register("number")} placeholder="000001" />
            </div>
            <div className="space-y-1">
              <Label>Data de Emissão *</Label>
              <Input type="date" {...register("issueDate")} />
              {errors.issueDate && <p className="text-xs text-red-500">{errors.issueDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Emitente *</Label>
              <Input {...register("emitter")} placeholder="Razão social do emitente" />
              {errors.emitter && <p className="text-xs text-red-500">{errors.emitter.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>CNPJ/CPF Emitente</Label>
              <Input {...register("emitterDocument")} placeholder="00.000.000/0001-00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Destinatário *</Label>
              <Input {...register("recipient")} placeholder="Razão social do destinatário" />
              {errors.recipient && <p className="text-xs text-red-500">{errors.recipient.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>CNPJ/CPF Destinatário</Label>
              <Input {...register("recipientDocument")} placeholder="00.000.000/0001-00" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Valor Total (R$) *</Label>
              <Input {...register("totalAmount")} placeholder="0.00" type="number" step="0.01" min="0" />
              {errors.totalAmount && <p className="text-xs text-red-500">{errors.totalAmount.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>CFOP</Label>
              <Input {...register("cfop")} placeholder="5102" />
            </div>
            <div className="space-y-1">
              <Label>Pedido Referência</Label>
              <Input {...register("referenceOrderId")} placeholder="PV-001" />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Impostos (R$)</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>ICMS</Label>
                <Input {...register("icmsAmount")} type="number" step="0.01" min="0" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>PIS</Label>
                <Input {...register("pisAmount")} type="number" step="0.01" min="0" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>COFINS</Label>
                <Input {...register("cofinsAmount")} type="number" step="0.01" min="0" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>ISS</Label>
                <Input {...register("issAmount")} type="number" step="0.01" min="0" placeholder="0.00" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea {...register("notes")} rows={2} placeholder="Observações opcionais..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editDoc ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FiscalPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState("documentos");

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [search, setSearch] = useState("");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  // Dialog state
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<FiscalDocument | null>(null);
  const [xmlImportOpen, setXmlImportOpen] = useState(false);

  const deleteMut = useDeleteFiscalDocument();

  const docsQuery = useListFiscalDocuments({
    type: filterType as "nfe" | "nfse" | "nf_entrada" | undefined || undefined,
    direction: filterDirection as "entrada" | "saida" | undefined || undefined,
    status: filterStatus as "issued" | "cancelled" | undefined || undefined,
    startDate: filterStart || undefined,
    endDate: filterEnd || undefined,
    search: search || undefined,
  });

  const dashQuery = useGetFiscalDashboard();
  const taxQuery = useGetFiscalTaxSummary({ year: taxYear });

  const docs = docsQuery.data ?? [];
  const dash = dashQuery.data;
  const taxSummary = taxQuery.data ?? [];

  const handleDelete = async (doc: FiscalDocument) => {
    if (!confirm(`Excluir o documento ${doc.number ? `NF ${doc.number}` : `#${doc.id}`}? Esta ação é irreversível.`)) return;
    try {
      await deleteMut.mutateAsync({ id: doc.id });
      qc.invalidateQueries({ queryKey: getListFiscalDocumentsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFiscalDashboardQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFiscalTaxSummaryQueryKey() });
      toast({ title: "Documento excluído" });
    } catch {
      toast({ title: "Erro ao excluir documento", variant: "destructive" });
    }
  };

  const openEdit = (doc: FiscalDocument) => {
    setEditDoc(doc);
    setDocDialogOpen(true);
  };

  const openNew = () => {
    setEditDoc(null);
    setDocDialogOpen(true);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterDirection) params.set("direction", filterDirection);
    if (filterStatus) params.set("status", filterStatus);
    if (filterStart) params.set("startDate", filterStart);
    if (filterEnd) params.set("endDate", filterEnd);
    if (search) params.set("search", search);
    const url = `/api/fiscal/export-csv?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "documentos-fiscais.csv";
    a.click();
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      nfe: "bg-blue-100 text-blue-800",
      nfse: "bg-purple-100 text-purple-800",
      nf_entrada: "bg-amber-100 text-amber-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] ?? "bg-gray-100 text-gray-700"}`}>
        {TYPE_LABELS[type] ?? type}
      </span>
    );
  };

  const statusBadge = (status: string) => <StatusBadge status={status} />;

  const clearFilters = () => {
    setFilterType("");
    setFilterDirection("");
    setFilterStatus("");
    setFilterStart("");
    setFilterEnd("");
    setSearch("");
  };

  const hasFilters = filterType || filterDirection || filterStatus || filterStart || filterEnd || search;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Fiscal"
          subtitle="Registro de documentos fiscais e apuração de impostos"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setXmlImportOpen(true)}>
                <FileCode className="h-4 w-4 mr-1.5" /> Importar XML NF-e
              </Button>
              <Button onClick={openNew} size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Novo Documento
              </Button>
            </div>
          }
        />

        {/* Dashboard cards */}
        {dash && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Documentos</p>
                    <p className="text-2xl font-bold">{dash.totalDocuments}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dash.issuedCount} emitidos · {dash.cancelledCount} cancelados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total Emitido</p>
                    <p className="text-xl font-bold">{fmtCurrency(dash.totalAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">ICMS / PIS</p>
                  <p className="text-lg font-semibold">{fmtCurrency(dash.totalIcms)}</p>
                  <p className="text-sm text-muted-foreground">{fmtCurrency(dash.totalPis)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">COFINS / ISS</p>
                  <p className="text-lg font-semibold">{fmtCurrency(dash.totalCofins)}</p>
                  <p className="text-sm text-muted-foreground">{fmtCurrency(dash.totalIss)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="documentos">
              <FileText className="h-4 w-4 mr-2" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="impostos">
              <BarChart3 className="h-4 w-4 mr-2" /> Apuração de Impostos
            </TabsTrigger>
          </TabsList>

          {/* ── Documentos tab ── */}
          <TabsContent value="documentos" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                  <div className="md:col-span-2">
                    <Input
                      placeholder="Buscar NF, emitente, destinatário..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="nfe">NF-e</SelectItem>
                      <SelectItem value="nfse">NFS-e</SelectItem>
                      <SelectItem value="nf_entrada">NF Entrada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterDirection || "all"} onValueChange={(v) => setFilterDirection(v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Direção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Entrada e saída</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="issued">Emitida</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="whitespace-nowrap">
                        <X className="h-3 w-3 mr-1" /> Limpar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleExportCsv} className="whitespace-nowrap">
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">De:</Label>
                    <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Até:</Label>
                    <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {docsQuery.isLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : docs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum documento encontrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Emitente</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead>Direção</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">ICMS</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>{typeBadge(doc.type)}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {doc.number ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate">{doc.emitter}</TableCell>
                          <TableCell className="max-w-[140px] truncate">{doc.recipient}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDate(doc.issueDate)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {DIRECTION_LABELS[doc.direction] ?? doc.direction}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{fmtCurrency(doc.totalAmount)}</TableCell>
                          <TableCell className="text-right text-sm">{fmtCurrency(doc.icmsAmount)}</TableCell>
                          <TableCell>{statusBadge(doc.status)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(doc)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDelete(doc)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Apuração de Impostos tab ── */}
          <TabsContent value="impostos" className="space-y-4">
            <div className="flex items-center gap-3">
              <Label>Ano:</Label>
              <Select value={String(taxYear)} onValueChange={(v) => setTaxYear(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {taxQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Bar chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Impostos por Mês — {taxYear}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={taxSummary} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) =>
                            value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          }
                        />
                        <Legend />
                        <Bar dataKey="icmsTotal" name="ICMS" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="pisTotal" name="PIS" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="cofinsTotal" name="COFINS" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="issTotal" name="ISS" fill="#10b981" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Monthly table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resumo Mensal</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mês</TableHead>
                          <TableHead className="text-right">Documentos</TableHead>
                          <TableHead className="text-right">Total Emitido</TableHead>
                          <TableHead className="text-right">ICMS</TableHead>
                          <TableHead className="text-right">PIS</TableHead>
                          <TableHead className="text-right">COFINS</TableHead>
                          <TableHead className="text-right">ISS</TableHead>
                          <TableHead className="text-right">Total Impostos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxSummary.map((row) => {
                          const totalTax =
                            parseFloat(row.icmsTotal) +
                            parseFloat(row.pisTotal) +
                            parseFloat(row.cofinsTotal) +
                            parseFloat(row.issTotal);
                          const isEmpty = row.documentCount === 0;
                          return (
                            <TableRow key={row.month} className={isEmpty ? "text-muted-foreground" : ""}>
                              <TableCell className="font-medium">{row.monthLabel}/{taxYear}</TableCell>
                              <TableCell className="text-right">{row.documentCount}</TableCell>
                              <TableCell className="text-right">{isEmpty ? "—" : fmtCurrency(row.totalAmount)}</TableCell>
                              <TableCell className="text-right">{isEmpty ? "—" : fmtCurrency(row.icmsTotal)}</TableCell>
                              <TableCell className="text-right">{isEmpty ? "—" : fmtCurrency(row.pisTotal)}</TableCell>
                              <TableCell className="text-right">{isEmpty ? "—" : fmtCurrency(row.cofinsTotal)}</TableCell>
                              <TableCell className="text-right">{isEmpty ? "—" : fmtCurrency(row.issTotal)}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {isEmpty ? "—" : fmtCurrency(String(totalTax))}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <DocDialog
        open={docDialogOpen}
        onClose={() => setDocDialogOpen(false)}
        editDoc={editDoc}
      />

      <NFeImportDialog
        open={xmlImportOpen}
        onClose={() => setXmlImportOpen(false)}
      />
    </AppLayout>
  );
}
