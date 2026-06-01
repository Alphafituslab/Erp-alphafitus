import { useState } from "react";
import { AppLayout } from "@/components/layout";
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
  getListFiscalDocumentsQueryKey,
  getGetFiscalTaxSummaryQueryKey,
  getGetFiscalDashboardQueryKey,
} from "@workspace/api-client-react";
import type { FiscalDocument } from "@workspace/api-client-react";

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

  const statusBadge = (status: string) => {
    if (status === "issued")
      return (
        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Emitida
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
        <X className="h-3 w-3 mr-1" /> Cancelada
      </Badge>
    );
  };

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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fiscal</h1>
            <p className="text-muted-foreground text-sm">Registro de documentos fiscais e apuração de impostos</p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo Documento
          </Button>
        </div>

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
    </AppLayout>
  );
}
