import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/contexts/auth";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListStockMovements, useCreateStockMovement, useGetEstoqueDashboard,
  useListWarehouses, useCreateWarehouse, useUpdateWarehouse,
  useListProductLots, useCreateProductLot, useUpdateProductLot,
  useAdjustLotInventory, useTransferLot, useGetLotMovements,
  useGetProductLotLabel,
  useListSuppliers,
  useGetEstoqueTurnover,
  getListProductsQueryKey, getListStockMovementsQueryKey,
  getGetEstoqueDashboardQueryKey, getListWarehousesQueryKey,
  getListProductLotsQueryKey, getGetLotMovementsQueryKey,
} from "@workspace/api-client-react";
import type { GetEstoqueTurnoverParams } from "@workspace/api-client-react";
import type { Product, Warehouse, ProductLot } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
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
  Plus, Pencil, Trash2, Package, AlertTriangle,
  TrendingDown, TrendingUp, ArrowDown, ArrowUp, Boxes,
  FlaskConical, Warehouse as WarehouseIcon, CalendarX, ArrowRightLeft,
  History, CheckCircle2, XCircle, Clock, Shield, Tag, Printer, FileCode,
  BarChart2, Activity, AlertOctagon, ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";
import jsPDF from "jspdf";
import { PdfExportDialog, addPdfHeader, addPdfFooter } from "@/components/pdf-export-dialog";
import type { PdfSettings } from "@/components/pdf-export-dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: string | number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function daysUntilExpiry(expirationDate: string | null | undefined): number | null {
  if (!expirationDate) return null;
  const exp = new Date(expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000);
}

function ExpiryBadge({ expirationDate }: { expirationDate?: string | null }) {
  const days = daysUntilExpiry(expirationDate);
  if (days === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (days < 0) return <Badge variant="destructive" className="text-xs">Vencido ({Math.abs(days)}d)</Badge>;
  if (days <= 30) return <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs">{days}d</Badge>;
  if (days <= 60) return <Badge className="bg-orange-100 text-orange-700 border border-orange-300 text-xs">{days}d</Badge>;
  if (days <= 90) return <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-300 text-xs">{days}d</Badge>;
  return <Badge variant="outline" className="text-xs text-muted-foreground">{days}d</Badge>;
}

function CqStatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Aprovado</Badge>;
  if (status === "quarantine") return <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-300 text-xs gap-1"><Clock className="h-3 w-3" />Quarentena</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs gap-1"><XCircle className="h-3 w-3" />Reprovado</Badge>;
  if (status === "blocked") return <Badge className="bg-gray-100 text-gray-700 border border-gray-300 text-xs gap-1"><Shield className="h-3 w-3" />Bloqueado</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

function LotTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    input: "Entrada",
    output: "Saída",
    transfer: "Transferência",
    adjustment: "Ajuste",
  };
  const color: Record<string, string> = {
    input: "text-green-600",
    output: "text-red-500",
    transfer: "text-blue-600",
    adjustment: "text-purple-600",
  };
  return <span className={`text-xs font-medium ${color[type] ?? ""}`}>{map[type] ?? type}</span>;
}

function stockStatus(product: Product): "ok" | "low" | "out" {
  const stock = Number(product.currentStock);
  if (stock === 0) return "out";
  if (stock <= Number(product.minStock)) return "low";
  return "ok";
}

function StockBadge({ product }: { product: Product }) {
  const status = stockStatus(product);
  if (status === "out") return <StatusBadge status="out" />;
  if (status === "low") return <StatusBadge status="low" label={`Baixo (${product.currentStock})`} />;
  return <StatusBadge status="active" label={String(product.currentStock)} showIcon={false} />;
}

// ─── Product Dialog ────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  secondaryUnit: z.string().optional(),
  costPrice: z.string().optional().refine((v) => !v || !isNaN(Number(v)), "Valor inválido"),
  salePrice: z.string().optional().refine((v) => !v || !isNaN(Number(v)), "Valor inválido"),
  minStock: z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Deve ser ≥ 0"),
  currentStock: z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Deve ser ≥ 0"),
  isCritical: z.boolean().optional(),
  // Fiscal
  ncm: z.string().optional(),
  cest: z.string().optional(),
  // Technical
  shelfLifeDays: z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Deve ser ≥ 0"),
  storageTemp: z.string().optional(),
  storageHumidity: z.string().optional(),
  regulatoryInfo: z.string().optional(),
  // Purchasing
  defaultSupplierId: z.string().optional(),
  leadTimeDays: z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Deve ser ≥ 0"),
});
type ProductForm = z.infer<typeof productSchema>;

const PRODUCT_EMPTY: ProductForm = {
  name: "", sku: "", description: "", category: "", unit: "un", secondaryUnit: "",
  costPrice: "", salePrice: "", minStock: "0", currentStock: "0", isCritical: false,
  ncm: "", cest: "", shelfLifeDays: "", storageTemp: "", storageHumidity: "",
  regulatoryInfo: "", defaultSupplierId: "", leadTimeDays: "",
};

function productValues(p: Product): ProductForm {
  return {
    name: p.name, sku: p.sku ?? "", description: p.description ?? "",
    category: p.category ?? "", unit: p.unit ?? "un", secondaryUnit: p.secondaryUnit ?? "",
    costPrice: p.costPrice ?? "", salePrice: p.salePrice ?? "",
    minStock: String(p.minStock), currentStock: String(p.currentStock),
    isCritical: p.isCritical === "true",
    ncm: p.ncm ?? "", cest: p.cest ?? "",
    shelfLifeDays: p.shelfLifeDays != null ? String(p.shelfLifeDays) : "",
    storageTemp: p.storageTemp ?? "", storageHumidity: p.storageHumidity ?? "",
    regulatoryInfo: p.regulatoryInfo ?? "",
    defaultSupplierId: p.defaultSupplierId != null ? String(p.defaultSupplierId) : "",
    leadTimeDays: p.leadTimeDays != null ? String(p.leadTimeDays) : "",
  };
}

function ProductDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Product | null }) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEstoqueDashboardQueryKey() });
  };
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const { data: suppliersPage } = useListSuppliers({ pageSize: 500 });
  const suppliers = suppliersPage?.items ?? [];

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    values: editing ? productValues(editing) : PRODUCT_EMPTY,
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      name: data.name, sku: data.sku || null, description: data.description || null,
      category: data.category || null, unit: data.unit || "un",
      secondaryUnit: data.secondaryUnit || null,
      costPrice: data.costPrice || null, salePrice: data.salePrice || null,
      minStock: data.minStock ? parseInt(data.minStock) : 0,
      currentStock: data.currentStock || "0",
      isCritical: data.isCritical ? "true" : "false",
      ncm: data.ncm || null, cest: data.cest || null,
      shelfLifeDays: data.shelfLifeDays ? parseInt(data.shelfLifeDays) : null,
      storageTemp: data.storageTemp || null, storageHumidity: data.storageHumidity || null,
      regulatoryInfo: data.regulatoryInfo || null,
      defaultSupplierId: data.defaultSupplierId ? parseInt(data.defaultSupplierId) : null,
      leadTimeDays: data.leadTimeDays ? parseInt(data.leadTimeDays) : null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });

  const F = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="pt-1">
          <Tabs defaultValue="geral">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="geral" className="flex-1">Geral</TabsTrigger>
              <TabsTrigger value="fiscal" className="flex-1">Fiscal</TabsTrigger>
              <TabsTrigger value="tecnico" className="flex-1">Técnico</TabsTrigger>
              <TabsTrigger value="compras" className="flex-1">Compras</TabsTrigger>
            </TabsList>

            {/* ── Geral ── */}
            <TabsContent value="geral" className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Nome *</label>
                  <Input {...form.register("name")} placeholder="Nome do produto" />
                  {F.name && <p className="text-xs text-destructive">{F.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">SKU</label>
                  <Input {...form.register("sku")} placeholder="ABC-001" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Descrição</label>
                <Input {...form.register("description")} placeholder="Opcional" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Categoria</label>
                  <Input {...form.register("category")} placeholder="Ex: Matéria-Prima" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Unidade principal</label>
                  <Input {...form.register("unit")} placeholder="un, kg, cx, L…" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Unidade secundária</label>
                  <Input {...form.register("secondaryUnit")} placeholder="caixa, pct…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Preço de custo (R$)</label>
                  <Input {...form.register("costPrice")} type="number" step="0.01" min="0" placeholder="0,00" />
                  {F.costPrice && <p className="text-xs text-destructive">{F.costPrice.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Preço de venda (R$)</label>
                  <Input {...form.register("salePrice")} type="number" step="0.01" min="0" placeholder="0,00" />
                  {F.salePrice && <p className="text-xs text-destructive">{F.salePrice.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Estoque mínimo</label>
                  <Input {...form.register("minStock")} type="number" min="0" step="1" />
                  {F.minStock && <p className="text-xs text-destructive">{F.minStock.message}</p>}
                </div>
                {!editing && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Estoque inicial</label>
                    <Input {...form.register("currentStock")} type="number" min="0" step="1" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Controller control={form.control} name="isCritical" render={({ field }) => (
                  <input id="isCritical" type="checkbox" checked={!!field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary" />
                )} />
                <label htmlFor="isCritical" className="text-sm font-medium cursor-pointer select-none">
                  Produto crítico (exige fornecedor aprovado no CQ)
                </label>
              </div>
            </TabsContent>

            {/* ── Fiscal ── */}
            <TabsContent value="fiscal" className="space-y-3">
              <p className="text-xs text-muted-foreground">Dados fiscais para emissão de NF-e.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">NCM</label>
                  <Input {...form.register("ncm")} placeholder="Ex: 30039099" maxLength={10} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">CEST</label>
                  <Input {...form.register("cest")} placeholder="Ex: 1300100" maxLength={10} />
                </div>
              </div>
            </TabsContent>

            {/* ── Técnico ── */}
            <TabsContent value="tecnico" className="space-y-3">
              <p className="text-xs text-muted-foreground">Especificações técnicas e condições de armazenamento.</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Validade (dias)</label>
                  <Input {...form.register("shelfLifeDays")} type="number" min="0" step="1" placeholder="365" />
                  {F.shelfLifeDays && <p className="text-xs text-destructive">{F.shelfLifeDays.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Temp. armazenamento</label>
                  <Input {...form.register("storageTemp")} placeholder="Ex: 2–8 °C" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Umidade relativa</label>
                  <Input {...form.register("storageHumidity")} placeholder="Ex: ≤ 60 %" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Informações regulatórias</label>
                <Textarea {...form.register("regulatoryInfo")} rows={3} placeholder="Registro ANVISA, Classe terapêutica, etc." />
              </div>
            </TabsContent>

            {/* ── Compras ── */}
            <TabsContent value="compras" className="space-y-3">
              <p className="text-xs text-muted-foreground">Parâmetros para planejamento de compras.</p>
              <div className="space-y-1">
                <label className="text-sm font-medium">Fornecedor padrão</label>
                <Controller control={form.control} name="defaultSupplierId" render={({ field }) => (
                  <select {...field} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                    <option value="">— Nenhum —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={String(s.id)}>{s.name}</option>
                    ))}
                  </select>
                )} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Lead time (dias úteis)</label>
                <Input {...form.register("leadTimeDays")} type="number" min="0" step="1" placeholder="Ex: 15" />
                {F.leadTimeDays && <p className="text-xs text-destructive">{F.leadTimeDays.message}</p>}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Movement Dialog ──────────────────────────────────────────────────────────

const movementSchema = z.object({
  productId: z.string().min(1, "Selecione um produto"),
  lotId: z.string().optional(),
  type: z.enum(["input", "output"]),
  quantity: z.string().refine((v) => parseInt(v) > 0, "Deve ser ≥ 1"),
  reason: z.string().optional(),
  notes: z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

function MovementDialog({ open, onClose, products, lots, defaultProductId }: {
  open: boolean; onClose: () => void; products: Product[]; lots: ProductLot[]; defaultProductId?: number;
}) {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getListStockMovementsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEstoqueDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListProductLotsQueryKey() });
  };
  const createMutation = useCreateStockMovement();

  const form = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { productId: defaultProductId ? String(defaultProductId) : "", lotId: "none", type: "input", quantity: "1", reason: "", notes: "" },
  });

  const selectedProductId = parseInt(form.watch("productId") || "0");
  const movType = form.watch("type");
  const selectedLotId = form.watch("lotId");

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Available lots for this product, approved only, sorted by expiry (FEFO)
  const productLots = useMemo(() => {
    if (!selectedProductId) return [];
    return lots
      .filter((l) => l.productId === selectedProductId && l.cqStatus === "approved" && l.availableQty > 0)
      .sort((a, b) => {
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return a.expirationDate.localeCompare(b.expirationDate);
      });
  }, [selectedProductId, lots]);

  const fefoLot = productLots[0];
  const selectedLot = productLots.find((l) => String(l.id) === selectedLotId);

  // Auto-suggest FEFO lot for output
  const handleProductChange = (pid: string) => {
    form.setValue("productId", pid);
    form.setValue("lotId", "none");
  };
  const handleTypeChange = (t: string) => {
    form.setValue("type", t as "input" | "output");
    if (t === "output" && fefoLot) {
      form.setValue("lotId", String(fefoLot.id));
    } else {
      form.setValue("lotId", "none");
    }
  };

  const onSubmit = form.handleSubmit((data) => {
    const lid = data.lotId && data.lotId !== "none" ? parseInt(data.lotId) : null;
    createMutation.mutate(
      { data: { productId: parseInt(data.productId), lotId: lid, type: data.type, quantity: parseInt(data.quantity), reason: data.reason || null, notes: data.notes || null } },
      {
        onSuccess: () => { invalidateAll(); onClose(); form.reset({ productId: "", lotId: "none", type: "input", quantity: "1", reason: "", notes: "" }); },
        onError: (err: any) => { form.setError("quantity", { message: err?.data?.error ?? "Erro ao registrar" }); },
      }
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar Movimentação</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Produto *</label>
            <Controller control={form.control} name="productId" render={({ field }) => (
              <Select value={field.value} onValueChange={handleProductChange}>
                <SelectTrigger><SelectValue placeholder="Selecionar produto…" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {form.formState.errors.productId && <p className="text-xs text-destructive">{form.formState.errors.productId.message}</p>}
          </div>
          {selectedProduct && (
            <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
              Estoque atual: <span className="font-semibold">{selectedProduct.currentStock} {selectedProduct.unit}</span>
              {" · "}Mínimo: <span className="font-semibold">{selectedProduct.minStock}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo</label>
              <Controller control={form.control} name="type" render={({ field }) => (
                <Select value={field.value} onValueChange={handleTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input"><span className="flex items-center gap-1.5"><ArrowDown className="h-3.5 w-3.5 text-green-600" /> Entrada</span></SelectItem>
                    <SelectItem value="output"><span className="flex items-center gap-1.5"><ArrowUp className="h-3.5 w-3.5 text-red-500" /> Saída</span></SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Quantidade *</label>
              <Input {...form.register("quantity")} type="number" min="1" step="1" max={selectedLot ? selectedLot.availableQty : undefined} />
              {form.formState.errors.quantity && <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>}
            </div>
          </div>

          {/* Lot picker — visible when product is selected and lots exist */}
          {selectedProductId > 0 && productLots.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-1.5">
                Lote
                {movType === "output" && fefoLot && <span className="text-xs text-blue-600 font-normal">(FEFO: {fefoLot.internalLot} vence {fmtDate(fefoLot.expirationDate)})</span>}
              </label>
              <Controller control={form.control} name="lotId" render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Sem lote específico" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem lote específico</SelectItem>
                    {productLots.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.internalLot}{l.expirationDate ? ` · val ${fmtDate(l.expirationDate)}` : ""} · {l.availableQty} {l.productUnit ?? "un"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {selectedLot && (
                <p className="text-xs text-muted-foreground">
                  Disponível no lote: <span className="font-semibold">{selectedLot.availableQty} {selectedLot.productUnit ?? "un"}</span>
                  {selectedLot.expirationDate && <> · Validade: <ExpiryBadge expirationDate={selectedLot.expirationDate} /></>}
                </p>
              )}
              {movType === "output" && productLots.length > 0 && (!selectedLotId || selectedLotId === "none") && (
                <p className="text-xs text-amber-600">Sugerido pelo FEFO: selecione o lote mais antigo ({fefoLot?.internalLot})</p>
              )}
            </div>
          )}

          <div className="space-y-1"><label className="text-sm font-medium">Motivo</label><Input {...form.register("reason")} placeholder="Ex: Compra, Venda, Ajuste manual…" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Observações</label><Input {...form.register("notes")} placeholder="Opcional" /></div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Salvando…" : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Warehouse Dialog ─────────────────────────────────────────────────────────

const warehouseSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  code: z.string().min(1, "Obrigatório").max(20),
  description: z.string().optional(),
});
type WarehouseForm = z.infer<typeof warehouseSchema>;

function WarehouseDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Warehouse | null }) {
  const qc = useQueryClient();
  const createM = useCreateWarehouse();
  const updateM = useUpdateWarehouse();

  const form = useForm<WarehouseForm>({
    resolver: zodResolver(warehouseSchema),
    values: editing
      ? { name: editing.name, code: editing.code, description: editing.description ?? "" }
      : { name: "", code: "", description: "" },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = { name: data.name, code: data.code, description: data.description || null };
    if (editing) {
      updateM.mutate({ id: editing.id, data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListWarehousesQueryKey() }); onClose(); } });
    } else {
      createM.mutate({ data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListWarehousesQueryKey() }); onClose(); form.reset(); } });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editing ? "Editar Depósito" : "Novo Depósito"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-sm font-medium">Nome *</label><Input {...form.register("name")} placeholder="Ex: Almoxarifado Central" />{form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}</div>
            <div className="space-y-1"><label className="text-sm font-medium">Código *</label><Input {...form.register("code")} placeholder="ALM-01" className="uppercase" />{form.formState.errors.code && <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>}</div>
          </div>
          <div className="space-y-1"><label className="text-sm font-medium">Descrição</label><Input {...form.register("description")} placeholder="Opcional" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending || updateM.isPending}>{createM.isPending || updateM.isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lot Dialog (Create) ──────────────────────────────────────────────────────

const lotSchema = z.object({
  productId: z.string().min(1, "Selecione um produto"),
  internalLot: z.string().min(1, "Obrigatório"),
  supplierLot: z.string().optional(),
  warehouseId: z.string().optional(),
  manufacturingDate: z.string().optional(),
  expirationDate: z.string().optional(),
  cqStatus: z.enum(["quarantine", "approved", "rejected", "blocked"]),
  totalQty: z.string().refine((v) => !isNaN(parseInt(v)) && parseInt(v) >= 0, "Deve ser ≥ 0"),
  notes: z.string().optional(),
});
type LotForm = z.infer<typeof lotSchema>;

function LotDialog({
  open, onClose, products, warehouses, defaultProductId, fefoLots,
}: {
  open: boolean; onClose: () => void; products: Product[]; warehouses: Warehouse[];
  defaultProductId?: number; fefoLots?: ProductLot[];
}) {
  const qc = useQueryClient();
  const createM = useCreateProductLot();

  const form = useForm<LotForm>({
    resolver: zodResolver(lotSchema),
    defaultValues: {
      productId: defaultProductId ? String(defaultProductId) : "",
      internalLot: `LOT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      supplierLot: "", warehouseId: "", manufacturingDate: "", expirationDate: "", cqStatus: "quarantine", totalQty: "0", notes: "",
    },
  });

  const selectedProductId = parseInt(form.watch("productId") || "0");
  const fefoSuggestion = fefoLots?.find((l) => l.productId === selectedProductId && l.cqStatus === "approved" && l.availableQty > 0);

  const onSubmit = form.handleSubmit((data) => {
    createM.mutate(
      {
        data: {
          productId: parseInt(data.productId),
          internalLot: data.internalLot,
          supplierLot: data.supplierLot || null,
          warehouseId: data.warehouseId ? parseInt(data.warehouseId) : null,
          manufacturingDate: data.manufacturingDate || null,
          expirationDate: data.expirationDate || null,
          cqStatus: data.cqStatus,
          totalQty: parseInt(data.totalQty),
          notes: data.notes || null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListProductLotsQueryKey() });
          qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetEstoqueDashboardQueryKey() });
          onClose(); form.reset();
        },
        onError: (err: any) => form.setError("internalLot", { message: err?.data?.error ?? "Erro" }),
      }
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Entrada de Lote</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Produto *</label>
            <Controller control={form.control} name="productId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Selecionar produto…" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {form.formState.errors.productId && <p className="text-xs text-destructive">{form.formState.errors.productId.message}</p>}
          </div>

          {fefoSuggestion && (
            <div className="text-xs bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-700">
              <span className="font-semibold">Sugestão FEFO:</span> Lote {fefoSuggestion.internalLot} vence em {fmtDate(fefoSuggestion.expirationDate)} — {fefoSuggestion.availableQty} {fefoSuggestion.productUnit ?? "un"} disponíveis. Use primeiro.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nº Lote Interno *</label>
              <Input {...form.register("internalLot")} />
              {form.formState.errors.internalLot && <p className="text-xs text-destructive">{form.formState.errors.internalLot.message}</p>}
            </div>
            <div className="space-y-1"><label className="text-sm font-medium">Nº Lote Fornecedor</label><Input {...form.register("supplierLot")} placeholder="Opcional" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Fabricação</label>
              <Input {...form.register("manufacturingDate")} type="date" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Validade</label>
              <Input {...form.register("expirationDate")} type="date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Depósito</label>
              <Controller control={form.control} name="warehouseId" render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem depósito</SelectItem>
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name} ({w.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status CQ</label>
              <Controller control={form.control} name="cqStatus" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarantine">Quarentena</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Reprovado</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Quantidade total *</label>
            <Input {...form.register("totalQty")} type="number" min="0" step="1" />
            {form.formState.errors.totalQty && <p className="text-xs text-destructive">{form.formState.errors.totalQty.message}</p>}
          </div>

          <div className="space-y-1"><label className="text-sm font-medium">Observações</label><Input {...form.register("notes")} placeholder="Opcional" /></div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending}>{createM.isPending ? "Salvando…" : "Registrar Lote"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lot Adjust Dialog ────────────────────────────────────────────────────────

function AdjustDialog({ lot, open, onClose }: { lot: ProductLot | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const adjustM = useAdjustLotInventory();
  const [newQty, setNewQty] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListProductLotsQueryKey() });
    qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEstoqueDashboardQueryKey() });
  };

  const handleSubmit = () => {
    if (!lot) return;
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty < 0) return;
    if (!reason.trim()) return;
    adjustM.mutate(
      { id: lot.id, data: { newAvailableQty: qty, reason: reason.trim(), notes: notes || null } },
      { onSuccess: () => { invalidate(); onClose(); setNewQty(""); setReason(""); setNotes(""); } }
    );
  };

  if (!lot) return null;
  const delta = newQty !== "" ? parseInt(newQty) - lot.availableQty : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Ajuste de Inventário</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-muted rounded px-3 py-2 text-sm space-y-1">
            <div><span className="text-muted-foreground">Lote:</span> <span className="font-mono font-medium">{lot.internalLot}</span></div>
            <div><span className="text-muted-foreground">Disponível atual:</span> <span className="font-semibold">{lot.availableQty} {lot.productUnit ?? "un"}</span></div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Nova quantidade disponível *</label>
            <Input type="number" min="0" step="1" value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="0" />
            {delta !== null && delta !== 0 && (
              <p className={`text-xs ${delta > 0 ? "text-green-600" : "text-red-500"}`}>
                {delta > 0 ? `+${delta}` : delta} unidades
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Justificativa *</label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo obrigatório: ex. Contagem física, quebra, devolução…" />
          </div>
          <div className="space-y-1"><label className="text-sm font-medium">Observações</label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={adjustM.isPending || !newQty || !reason.trim()}>
              {adjustM.isPending ? "Ajustando…" : "Confirmar Ajuste"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lot Transfer Dialog ──────────────────────────────────────────────────────

function TransferDialog({ lot, open, onClose, warehouses }: { lot: ProductLot | null; open: boolean; onClose: () => void; warehouses: Warehouse[] }) {
  const qc = useQueryClient();
  const transferM = useTransferLot();
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: getListProductLotsQueryKey() });

  const handleSubmit = () => {
    if (!lot) return;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0 || !toWarehouseId || !reason.trim()) return;
    transferM.mutate(
      { id: lot.id, data: { toWarehouseId: parseInt(toWarehouseId), quantity: qty, reason: reason.trim(), notes: notes || null } },
      { onSuccess: () => { invalidate(); onClose(); setToWarehouseId(""); setQuantity(""); setReason(""); setNotes(""); } }
    );
  };

  if (!lot) return null;
  const otherWarehouses = warehouses.filter((w) => w.id !== lot.warehouseId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Transferência entre Depósitos</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-muted rounded px-3 py-2 text-sm space-y-1">
            <div><span className="text-muted-foreground">Lote:</span> <span className="font-mono font-medium">{lot.internalLot}</span></div>
            <div><span className="text-muted-foreground">Origem:</span> {lot.warehouseName ?? "Sem depósito"}</div>
            <div><span className="text-muted-foreground">Disponível:</span> <span className="font-semibold">{lot.availableQty} {lot.productUnit ?? "un"}</span></div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Depósito destino *</label>
            <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>{otherWarehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name} ({w.code})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantidade *</label>
            <Input type="number" min="1" max={lot.availableQty} step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Motivo *</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Redistribuição, abastecimento linha…" />
          </div>
          <div className="space-y-1"><label className="text-sm font-medium">Observações</label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={transferM.isPending || !toWarehouseId || !quantity || !reason.trim()}>
              {transferM.isPending ? "Transferindo…" : "Transferir"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lot Detail Sheet (Rastreabilidade) ──────────────────────────────────────

function LotDetailSheet({ lot, open, onClose, onAdjust, onTransfer, warehouses }: {
  lot: ProductLot | null; open: boolean; onClose: () => void;
  onAdjust: (lot: ProductLot) => void; onTransfer: (lot: ProductLot) => void;
  warehouses: Warehouse[];
}) {
  const qc = useQueryClient();
  const updateM = useUpdateProductLot();
  const lotId = lot?.id ?? 0;
  const { data: movements = [], isLoading } = useGetLotMovements(lotId, { query: { enabled: !!lot, queryKey: getGetLotMovementsQueryKey(lotId) } });

  if (!lot) return null;

  const handleCqChange = (newStatus: string) => {
    updateM.mutate(
      { id: lot.id, data: { cqStatus: newStatus as any } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListProductLotsQueryKey() }) }
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] sm:w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{lot.internalLot}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Produto:</span><div className="font-medium">{lot.productName ?? "—"}</div></div>
            <div><span className="text-muted-foreground">Lote Fornecedor:</span><div className="font-mono text-xs">{lot.supplierLot ?? "—"}</div></div>
            <div><span className="text-muted-foreground">Fabricação:</span><div>{fmtDate(lot.manufacturingDate)}</div></div>
            <div><span className="text-muted-foreground">Validade:</span><div className="flex items-center gap-2">{fmtDate(lot.expirationDate)} <ExpiryBadge expirationDate={lot.expirationDate} /></div></div>
            <div><span className="text-muted-foreground">Depósito:</span><div>{lot.warehouseName ?? "—"}</div></div>
            <div><span className="text-muted-foreground">Status CQ:</span><div className="mt-1"><CqStatusBadge status={lot.cqStatus} /></div></div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total", value: lot.totalQty, color: "text-foreground" },
              { label: "Disponível", value: lot.availableQty, color: "text-green-600" },
              { label: "Reservado", value: lot.reservedQty, color: "text-blue-600" },
              { label: "Bloqueado", value: lot.blockedQty, color: "text-red-500" },
            ].map((q) => (
              <div key={q.label} className="bg-muted rounded p-2 text-center">
                <div className={`text-lg font-semibold ${q.color}`}>{q.value}</div>
                <div className="text-xs text-muted-foreground">{q.label}</div>
              </div>
            ))}
          </div>

          {/* CQ Status change */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Alterar Status CQ</p>
            <div className="flex flex-wrap gap-2">
              {["quarantine", "approved", "rejected", "blocked"].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={lot.cqStatus === s ? "default" : "outline"}
                  onClick={() => handleCqChange(s)}
                  disabled={lot.cqStatus === s || updateM.isPending}
                >
                  <CqStatusBadge status={s} />
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onAdjust(lot)}><FlaskConical className="h-3.5 w-3.5 mr-1" />Ajustar</Button>
            <Button size="sm" variant="outline" onClick={() => onTransfer(lot)}><ArrowRightLeft className="h-3.5 w-3.5 mr-1" />Transferir</Button>
          </div>

          {/* Movement history */}
          <div>
            <p className="text-sm font-semibold flex items-center gap-2 mb-2"><History className="h-4 w-4" />Rastreabilidade</p>
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && (movements as any[]).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>}
            <div className="space-y-2">
              {(movements as any[]).map((m: any) => (
                <div key={m.id} className="border rounded px-3 py-2 text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <LotTypeBadge type={m.type} />
                    <span className="text-muted-foreground">{fmtDateTime(m.createdAt)}</span>
                  </div>
                  <div className="font-medium">
                    {m.type === "transfer"
                      ? `${m.warehouseName ?? "—"} → ${m.toWarehouseName ?? "—"} · ${m.quantity} un`
                      : `${m.type === "input" ? "+" : m.type === "adjustment" ? "±" : "-"}${m.quantity} ${lot.productUnit ?? "un"}`}
                  </div>
                  {m.reason && <div className="text-muted-foreground">{m.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Lot Label Dialog ─────────────────────────────────────────────────────────

function LotLabelDialog({ lotId, onClose }: { lotId: number | null; onClose: () => void }) {
  const { data: label, isLoading } = useGetProductLotLabel(
    lotId ?? 0,
    { query: { enabled: !!lotId } as any }
  );

  const cqLabel: Record<string, string> = {
    quarantine: "QUARENTENA",
    approved: "APROVADO",
    rejected: "REPROVADO",
    blocked: "BLOQUEADO",
  };

  const cqColor: Record<string, string> = {
    quarantine: "bg-yellow-100 text-yellow-800 border-yellow-300",
    approved: "bg-green-100 text-green-800 border-green-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
    blocked: "bg-gray-100 text-gray-800 border-gray-300",
  };

  return (
    <Dialog open={!!lotId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Etiqueta do Lote
          </DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>}
        {label && (
          <div className="space-y-3">
            <div id="lot-label-print" className="border-2 border-dashed border-border rounded-lg p-4 space-y-2 font-mono text-xs print:border-solid">
              <div className="text-center font-bold text-base tracking-wide uppercase mb-2">
                {label.productName}
              </div>
              {label.productSku && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SKU:</span>
                  <span className="font-semibold">{label.productSku}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lote Interno:</span>
                <span className="font-bold tracking-wider">{label.internalLot}</span>
              </div>
              {label.supplierLot && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lote Fornecedor:</span>
                  <span>{label.supplierLot}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantidade:</span>
                <span className="font-semibold">{parseFloat(label.totalQty).toLocaleString("pt-BR")} {label.unit}</span>
              </div>
              {label.expirationDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Validade:</span>
                  <span className="font-semibold">{new Date(label.expirationDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                </div>
              )}
              {label.manufacturingDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fabricação:</span>
                  <span>{new Date(label.manufacturingDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                </div>
              )}
              {label.warehouseName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depósito:</span>
                  <span>{label.warehouseName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrada:</span>
                <span>{new Date(label.receivedAt + "T00:00:00").toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex justify-center mt-2">
                <span className={`px-3 py-1 rounded border font-bold text-sm uppercase tracking-widest ${cqColor[label.cqStatus] ?? "bg-muted text-muted-foreground"}`}>
                  {cqLabel[label.cqStatus] ?? label.cqStatus}
                </span>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EstoquePage() {
  const qc = useQueryClient();
  const { canEditModule } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Product state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockAlertFilter, setStockAlertFilter] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  // Movement state
  const [movementDialog, setMovementDialog] = useState(false);
  const [movementProductId, setMovementProductId] = useState<number | undefined>();
  const [movTypeFilter, setMovTypeFilter] = useState("all");
  const [movSearch, setMovSearch] = useState("");

  // Lot state
  const [lotDialog, setLotDialog] = useState(false);
  const [lotDefaultProductId, setLotDefaultProductId] = useState<number | undefined>();
  const [lotSearch, setLotSearch] = useState("");
  const [lotCqFilter, setLotCqFilter] = useState("all");
  const [lotWarehouseFilter, setLotWarehouseFilter] = useState("all");
  const [lotExpiryFilter, setLotExpiryFilter] = useState("all");
  const [selectedLot, setSelectedLot] = useState<ProductLot | null>(null);
  const [adjustLot, setAdjustLot] = useState<ProductLot | null>(null);
  const [transferLot, setTransferLot] = useState<ProductLot | null>(null);

  // Lot label state
  const [labelLotId, setLabelLotId] = useState<number | null>(null);

  // Warehouse state
  const [warehouseDialog, setWarehouseDialog] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Turnover / Análise de Giro state
  const [turnoverDateFrom, setTurnoverDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [turnoverDateTo, setTurnoverDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [turnoverCategory, setTurnoverCategory] = useState("all");
  const [turnoverInactiveDays, setTurnoverInactiveDays] = useState(30);
  const [turnoverOnlyInactive, setTurnoverOnlyInactive] = useState(false);
  const [turnoverSort, setTurnoverSort] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "turnoverRate", dir: "asc" });

  const PAGE_SIZE = 20;
  const [productsPage, setProductsPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);

  const productsParams = useMemo(() => ({
    page: productsPage,
    pageSize: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
    ...(stockAlertFilter ? { lowStock: "true" as const } : {}),
  }), [productsPage, search, categoryFilter, stockAlertFilter]);

  const movementsParams = useMemo(() => ({
    page: movementsPage,
    pageSize: PAGE_SIZE,
    ...(movTypeFilter !== "all" ? { type: movTypeFilter as "input" | "output" } : {}),
  }), [movementsPage, movTypeFilter]);

  useEffect(() => { setProductsPage(1); }, [search, categoryFilter, stockAlertFilter]);
  useEffect(() => { setMovementsPage(1); }, [movTypeFilter]);

  const { data: productsData, isLoading: productsLoading } = useListProducts(productsParams);
  const { data: movementsData, isLoading: movementsLoading } = useListStockMovements(movementsParams);
  const { data: allProductsData } = useListProducts({ pageSize: 500 });
  const products = productsData?.items ?? [];
  const movements = movementsData?.items ?? [];
  const allProducts = allProductsData?.items ?? [];
  const { data: dashboard } = useGetEstoqueDashboard();
  const { data: warehouses = [] } = useListWarehouses({});
  const { data: lots = [], isLoading: lotsLoading } = useListProductLots({});

  const turnoverParams = useMemo<GetEstoqueTurnoverParams>(() => ({
    dateFrom: turnoverDateFrom,
    dateTo: turnoverDateTo,
    inactiveDays: turnoverInactiveDays,
    ...(turnoverCategory !== "all" ? { category: turnoverCategory } : {}),
  }), [turnoverDateFrom, turnoverDateTo, turnoverInactiveDays, turnoverCategory]);

  const { data: turnoverData, isLoading: turnoverLoading } = useGetEstoqueTurnover(turnoverParams);

  const deleteMutation = useDeleteProduct();

  const activeProducts = useMemo(() => products.filter((p) => p.active === "true"), [products]);
  const allActiveProducts = useMemo(() => allProducts.filter((p) => p.active === "true"), [allProducts]);

  const categories = useMemo(() => {
    const cats = new Set(allActiveProducts.map((p) => p.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [allActiveProducts]);

  const filteredProducts = activeProducts;

  const filteredMovements = useMemo(() => {
    if (!movSearch) return movements;
    const q = movSearch.toLowerCase();
    return movements.filter((m) => (m.productName ?? "").toLowerCase().includes(q) || (m.reason ?? "").toLowerCase().includes(q));
  }, [movements, movSearch]);

  const filteredLots = useMemo(() => {
    let list = [...lots];
    if (lotCqFilter !== "all") list = list.filter((l) => l.cqStatus === lotCqFilter);
    if (lotWarehouseFilter !== "all") list = list.filter((l) => String(l.warehouseId ?? "") === lotWarehouseFilter);
    if (lotExpiryFilter !== "all") {
      const days = parseInt(lotExpiryFilter);
      const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter((l) => l.expirationDate && l.expirationDate >= today && l.expirationDate <= cutoff);
    }
    if (lotSearch) {
      const q = lotSearch.toLowerCase();
      list = list.filter((l) => l.internalLot.toLowerCase().includes(q) || (l.supplierLot ?? "").toLowerCase().includes(q) || (l.productName ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [lots, lotCqFilter, lotWarehouseFilter, lotExpiryFilter, lotSearch]);

  function openMovementFor(productId?: number) {
    setMovementProductId(productId); setMovementDialog(true);
  }
  function openLotFor(productId?: number) {
    setLotDefaultProductId(productId); setLotDialog(true);
  }
  function goToLotsWithFilter(cqStatus?: string) {
    if (cqStatus) setLotCqFilter(cqStatus);
    setActiveTab("lots");
  }

  async function handleExportPdf(settings: PdfSettings) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const lm = 14, rm = 196;

    const subtitle = `Produtos: ${allActiveProducts.length} ativos · Lotes: ${lots.length} · Depósitos: ${warehouses.length}`;
    let y = addPdfHeader(doc, settings, "Relatório de Estoque", subtitle);

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

    // ── Produtos ──
    drawSectionHeader(`Produtos Ativos (${allActiveProducts.length})`);
    const prodHeaders = ["Nome", "SKU", "Categoria", "Unid.", "Estoque Atual", "Estoque Mín.", "Preço Custo"];
    const prodColX = [lm, lm + 52, lm + 76, lm + 110, lm + 124, lm + 143, lm + 162];
    drawTableHeader(prodHeaders, prodColX);
    doc.setFont("helvetica", "normal");
    let rowBg = false;
    for (const p of allActiveProducts) {
      if (y > 272) {
        doc.addPage(); y = 14;
        drawTableHeader(prodHeaders, prodColX);
        doc.setFont("helvetica", "normal");
        rowBg = false;
      }
      if (rowBg) { doc.setFillColor("#f8fafc"); doc.rect(lm, y, rm - lm, 6, "F"); }
      rowBg = !rowBg;
      doc.setFontSize(7.5);
      doc.setTextColor("#000000");
      doc.text(p.name.slice(0, 28), prodColX[0] + 1, y + 4.5);
      doc.text((p.sku ?? "—").slice(0, 12), prodColX[1] + 1, y + 4.5);
      doc.text((p.category ?? "—").slice(0, 14), prodColX[2] + 1, y + 4.5);
      doc.text((p.unit ?? "—").slice(0, 6), prodColX[3] + 1, y + 4.5);
      const stock = Number(p.currentStock);
      const minStock = Number(p.minStock);
      doc.setTextColor(stock === 0 ? "#991b1b" : stock <= minStock ? "#c2410c" : "#166534");
      doc.text(String(p.currentStock ?? 0), prodColX[4] + 10, y + 4.5, { align: "right" });
      doc.setTextColor("#000000");
      doc.text(String(p.minStock ?? 0), prodColX[5] + 10, y + 4.5, { align: "right" });
      const price = p.costPrice ? parseFloat(p.costPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—";
      doc.text(price, prodColX[6] + 18, y + 4.5, { align: "right" });
      doc.setDrawColor("#e2e8f0");
      doc.line(lm, y + 6, rm, y + 6);
      y += 6;
    }

    y += 6;

    // ── Lotes ──
    drawSectionHeader(`Lotes (${filteredLots.length})`);
    const lotHeaders = ["Lote Interno", "Produto", "Depósito", "Qtd.", "Status CQ", "Validade"];
    const lotColX = [lm, lm + 32, lm + 78, lm + 118, lm + 132, lm + 158];
    drawTableHeader(lotHeaders, lotColX);
    doc.setFont("helvetica", "normal");
    rowBg = false;
    for (const lot of filteredLots) {
      if (y > 272) {
        doc.addPage(); y = 14;
        drawTableHeader(lotHeaders, lotColX);
        doc.setFont("helvetica", "normal");
        rowBg = false;
      }
      if (rowBg) { doc.setFillColor("#f8fafc"); doc.rect(lm, y, rm - lm, 6, "F"); }
      rowBg = !rowBg;
      doc.setFontSize(7.5);
      doc.setTextColor("#000000");
      doc.text(lot.internalLot.slice(0, 18), lotColX[0] + 1, y + 4.5);
      doc.text((lot.productName ?? "—").slice(0, 22), lotColX[1] + 1, y + 4.5);
      doc.text((lot.warehouseName ?? "—").slice(0, 18), lotColX[2] + 1, y + 4.5);
      doc.text(String(lot.availableQty ?? 0), lotColX[3] + 8, y + 4.5, { align: "right" });
      const cqMap: Record<string, string> = { approved: "Aprovado", quarantine: "Quarentena", rejected: "Reprovado", blocked: "Bloqueado" };
      doc.setTextColor(lot.cqStatus === "approved" ? "#166534" : lot.cqStatus === "rejected" ? "#991b1b" : lot.cqStatus === "quarantine" ? "#78350f" : "#374151");
      doc.text(cqMap[lot.cqStatus] ?? lot.cqStatus, lotColX[4] + 1, y + 4.5);
      doc.setTextColor("#000000");
      const days = daysUntilExpiry(lot.expirationDate);
      const expText = lot.expirationDate ? fmtDate(lot.expirationDate) + (days !== null && days < 0 ? " (Vencido)" : days !== null && days <= 30 ? ` (${days}d)` : "") : "—";
      if (days !== null && days < 0) doc.setTextColor("#991b1b");
      else if (days !== null && days <= 30) doc.setTextColor("#c2410c");
      doc.text(expText.slice(0, 20), lotColX[5] + 1, y + 4.5);
      doc.setTextColor("#000000");
      doc.setDrawColor("#e2e8f0");
      doc.line(lm, y + 6, rm, y + 6);
      y += 6;
    }

    addPdfFooter(doc, settings);
    doc.save(`relatorio-estoque-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Estoque"
          subtitle="Produtos, lotes, validade e movimentações"
          actions={
            <>
              <PdfExportDialog onExport={handleExportPdf} />
              <Button variant="outline" size="sm" asChild>
                <a href="/erp/fiscal?openXmlImport=1">
                  <FileCode className="h-4 w-4 mr-1.5" /> Importar XML NF-e
                </a>
              </Button>
            </>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="lots">Lotes</TabsTrigger>
            <TabsTrigger value="movements">Movimentações</TabsTrigger>
            <TabsTrigger value="warehouses">Depósitos</TabsTrigger>
            <TabsTrigger value="turnover"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />Análise de Giro</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ─────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            {/* KPI cards row 1 — products */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total de produtos</CardTitle>
                  <Boxes className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{dashboard?.totalProducts ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ativos no catálogo</p>
                </CardContent>
              </Card>

              <Card className={((dashboard?.lowStockCount ?? 0) > 0) ? "cursor-pointer hover:border-yellow-400 transition-colors" : ""} onClick={() => (dashboard?.lowStockCount ?? 0) > 0 && (() => { setStockAlertFilter(true); setCategoryFilter("all"); setActiveTab("products"); })()}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Estoque baixo</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-yellow-600">{dashboard?.lowStockCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(dashboard?.lowStockCount ?? 0) > 0 ? "Clique para ver" : "Abaixo do mínimo"}</p>
                </CardContent>
              </Card>

              <Card className={((dashboard?.outOfStockCount ?? 0) > 0) ? "cursor-pointer hover:border-red-400 transition-colors" : ""} onClick={() => (dashboard?.outOfStockCount ?? 0) > 0 && (() => { setStockAlertFilter(true); setCategoryFilter("all"); setActiveTab("products"); })()}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sem estoque</CardTitle>
                  <TrendingDown className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-destructive">{dashboard?.outOfStockCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(dashboard?.outOfStockCount ?? 0) > 0 ? "Clique para ver" : "Produtos zerados"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Valor em estoque</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{fmt(dashboard?.totalStockValue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Custo × quantidade</p>
                </CardContent>
              </Card>
            </div>

            {/* KPI cards row 2 — lots */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className={(dashboard?.expiringLots30 ?? 0) > 0 ? "cursor-pointer border-red-200 hover:border-red-400 transition-colors" : ""} onClick={() => (dashboard?.expiringLots30 ?? 0) > 0 && goToLotsWithFilter()}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vencem em 30 dias</CardTitle>
                  <CalendarX className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-red-600">{dashboard?.expiringLots30 ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Lotes com validade crítica</p>
                </CardContent>
              </Card>

              <Card className={(dashboard?.expiringLots60 ?? 0) > 0 ? "cursor-pointer border-orange-200 hover:border-orange-400 transition-colors" : ""} onClick={() => (dashboard?.expiringLots60 ?? 0) > 0 && goToLotsWithFilter()}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vencem em 60 dias</CardTitle>
                  <CalendarX className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-orange-600">{dashboard?.expiringLots60 ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(dashboard?.expiringLots60 ?? 0) > 0 ? "Clique para ver" : "Nenhum"}</p>
                </CardContent>
              </Card>

              <Card className={(dashboard?.expiringLots90 ?? 0) > 0 ? "cursor-pointer border-yellow-200 hover:border-yellow-400 transition-colors" : ""} onClick={() => (dashboard?.expiringLots90 ?? 0) > 0 && goToLotsWithFilter()}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vencem em 90 dias</CardTitle>
                  <CalendarX className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-yellow-600">{dashboard?.expiringLots90 ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(dashboard?.expiringLots90 ?? 0) > 0 ? "Clique para ver" : "Nenhum"}</p>
                </CardContent>
              </Card>

              <Card className={(dashboard?.quarantineLots ?? 0) > 0 ? "cursor-pointer border-yellow-200 hover:border-yellow-400 transition-colors" : ""} onClick={() => (dashboard?.quarantineLots ?? 0) > 0 && goToLotsWithFilter("quarantine")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Em quarentena</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-yellow-600">{dashboard?.quarantineLots ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(dashboard?.quarantineLots ?? 0) > 0 ? "Aguardando CQ" : "Nenhum"}</p>
                </CardContent>
              </Card>
            </div>

            {/* KPI row 3 — quarantine aging alert */}
            {(dashboard?.quarantineAgingLots ?? 0) > 0 && (
              <div className="grid grid-cols-1 gap-4">
                <Card className="cursor-pointer border-red-200 hover:border-red-400 transition-colors bg-red-50" onClick={() => goToLotsWithFilter("quarantine")}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <CardTitle className="text-sm font-medium text-red-700">
                        {dashboard?.quarantineAgingLots} {dashboard?.quarantineAgingLots === 1 ? "lote" : "lotes"} em quarentena há mais de 30 dias — requer ação do CQ
                      </CardTitle>
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 text-xs h-7" onClick={(e) => { e.stopPropagation(); goToLotsWithFilter("quarantine"); }}>
                      Ver lotes →
                    </Button>
                  </CardHeader>
                  {(dashboard?.quarantineAgingList ?? []).length > 0 && (
                    <CardContent className="pt-0 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {(dashboard?.quarantineAgingList ?? []).map((l) => (
                          <Badge key={l.id} variant="outline" className="border-red-300 text-red-700 bg-white font-mono text-xs cursor-pointer" onClick={() => { setSelectedLot(l); setActiveTab("lots"); }}>
                            {l.internalLot} · {l.productName ?? "—"} · {l.totalQty} {l.productUnit ?? "un"}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            )}

            {/* Expiring lots + quarantine lists */}
            {((dashboard?.expiringLotsList ?? []).length > 0 || (dashboard?.quarantineLotsList ?? []).length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {(dashboard?.expiringLotsList ?? []).length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Lotes vencendo em 90 dias</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => goToLotsWithFilter()}>Ver todos</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader><TableRow><TableHead>Lote</TableHead><TableHead>Produto</TableHead><TableHead>Qtd</TableHead><TableHead>Validade</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {(dashboard?.expiringLotsList ?? []).map((l) => (
                            <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedLot(l); setActiveTab("lots"); }}>
                              <TableCell className="font-mono text-xs">{l.internalLot}</TableCell>
                              <TableCell className="text-sm">{l.productName ?? "—"}</TableCell>
                              <TableCell className="text-sm font-medium">{l.availableQty}</TableCell>
                              <TableCell><ExpiryBadge expirationDate={l.expirationDate} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                {(dashboard?.quarantineLotsList ?? []).length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Lotes em quarentena</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => goToLotsWithFilter("quarantine")}>Ver todos</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader><TableRow><TableHead>Lote</TableHead><TableHead>Produto</TableHead><TableHead>Qtd</TableHead><TableHead>Entrada</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {(dashboard?.quarantineLotsList ?? []).map((l) => (
                            <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedLot(l); setActiveTab("lots"); }}>
                              <TableCell className="font-mono text-xs">{l.internalLot}</TableCell>
                              <TableCell className="text-sm">{l.productName ?? "—"}</TableCell>
                              <TableCell className="text-sm font-medium">{l.totalQty}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{fmtDate(l.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Low stock + recent movements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Produtos com alerta de estoque</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => openMovementFor()}><Plus className="h-3.5 w-3.5 mr-1" />Entrada</Button>
                </CardHeader>
                <CardContent className="p-0">
                  {(dashboard?.lowStockProducts ?? []).length === 0
                    ? <p className="text-sm text-muted-foreground px-6 pb-4">Nenhum produto em alerta ✓</p>
                    : (
                      <Table>
                        <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Estoque</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>
                          {(dashboard?.lowStockProducts ?? []).map((p) => (
                            <TableRow key={p.id}>
                              <TableCell><div className="font-medium text-sm">{p.name}</div>{p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}</TableCell>
                              <TableCell className="text-right"><StockBadge product={p} /></TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">{p.minStock}</TableCell>
                              <TableCell><Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openMovementFor(p.id)}>+ Entrada</Button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Últimas movimentações</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(dashboard?.recentMovements ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada</p>}
                  {(dashboard?.recentMovements ?? []).map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {m.type === "input" ? <ArrowDown className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> : <ArrowUp className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">{m.productName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{m.reason ?? m.referenceType ?? "—"}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${m.type === "input" ? "text-green-600" : "text-red-500"}`}>{m.type === "input" ? "+" : "-"}{m.quantity}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(m.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── PRODUCTS TAB ──────────────────────────────────────────── */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3 flex-wrap items-center">
                <Input className="w-56" placeholder="Buscar por nome, SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {stockAlertFilter && (
                  <Badge variant="outline" className="gap-1.5 cursor-pointer border-yellow-500 text-yellow-700 bg-yellow-50 hover:bg-yellow-100" onClick={() => setStockAlertFilter(false)}>
                    <AlertTriangle className="h-3 w-3" />Somente alertas<span className="ml-0.5 text-yellow-500">×</span>
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openMovementFor()}><Package className="h-4 w-4 mr-2" />Movimentação</Button>
                {canEditModule('estoque') && (
                  <Button onClick={() => { setEditingProduct(null); setProductDialog(true); }}><Plus className="h-4 w-4 mr-2" />Novo produto</Button>
                )}
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead><TableHead>SKU</TableHead><TableHead>Categoria</TableHead>
                      <TableHead>Unid.</TableHead><TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Venda</TableHead><TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>}
                    {!productsLoading && filteredProducts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhum produto encontrado</TableCell></TableRow>}
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell><div className="font-medium">{product.name}</div>{product.description && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{product.description}</div>}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{product.sku ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{product.category ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{product.unit}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{product.costPrice ? fmt(product.costPrice) : "—"}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{product.salePrice ? fmt(product.salePrice) : "—"}</TableCell>
                        <TableCell className="text-center"><StockBadge product={product} /></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Entrada de lote" onClick={() => openLotFor(product.id)}><FlaskConical className="h-4 w-4 text-blue-600" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" title="Movimentação" onClick={() => openMovementFor(product.id)}><Package className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingProduct(product); setProductDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteProduct(product)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(productsData?.totalPages ?? 1) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">Página {productsData?.page} de {productsData?.totalPages} — {productsData?.total} registros</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setProductsPage((p) => Math.max(1, p - 1))} disabled={productsPage <= 1}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setProductsPage((p) => p + 1)} disabled={productsPage >= (productsData?.totalPages ?? 1)}>Próxima</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── LOTS TAB ──────────────────────────────────────────────── */}
          <TabsContent value="lots" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3 flex-wrap items-center">
                <Input className="w-52" placeholder="Buscar lote, produto…" value={lotSearch} onChange={(e) => setLotSearch(e.target.value)} />
                <Select value={lotCqFilter} onValueChange={setLotCqFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="quarantine">Quarentena</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Reprovado</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={lotWarehouseFilter} onValueChange={setLotWarehouseFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os depósitos</SelectItem>
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={lotExpiryFilter} onValueChange={setLotExpiryFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer validade</SelectItem>
                    <SelectItem value="30">Vencendo em 30d</SelectItem>
                    <SelectItem value="60">Vencendo em 60d</SelectItem>
                    <SelectItem value="90">Vencendo em 90d</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => openLotFor()}><Plus className="h-4 w-4 mr-2" />Entrada de lote</Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote Interno</TableHead>
                      <TableHead>Lote Fornecedor</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Depósito</TableHead>
                      <TableHead>Status CQ</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">Reservado</TableHead>
                      <TableHead className="text-right">Bloqueado</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotsLoading && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>}
                    {!lotsLoading && filteredLots.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                          Nenhum lote encontrado{lots.length === 0 ? ". Clique em \"Entrada de lote\" para registrar o primeiro." : "."}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredLots.map((lot) => (
                      <TableRow key={lot.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedLot(lot)}>
                        <TableCell className="font-mono text-xs font-medium">{lot.internalLot}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{lot.supplierLot ?? "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{lot.productName ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{lot.productUnit}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lot.warehouseName ?? "—"}</TableCell>
                        <TableCell><CqStatusBadge status={lot.cqStatus} /></TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{lot.totalQty}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-semibold text-green-700">{lot.availableQty}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-blue-600">{lot.reservedQty}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-red-500">{lot.blockedQty}</TableCell>
                        <TableCell><ExpiryBadge expirationDate={lot.expirationDate} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Imprimir etiqueta" onClick={() => setLabelLotId(lot.id)}><Tag className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Ajustar inventário" onClick={() => setAdjustLot(lot)}><FlaskConical className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Transferir" onClick={() => setTransferLot(lot)}><ArrowRightLeft className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MOVEMENTS TAB ─────────────────────────────────────────── */}
          <TabsContent value="movements" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <Input className="w-56" placeholder="Buscar por produto, motivo…" value={movSearch} onChange={(e) => setMovSearch(e.target.value)} />
                <Select value={movTypeFilter} onValueChange={setMovTypeFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="input">Entrada</SelectItem>
                    <SelectItem value="output">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => openMovementFor()}><Plus className="h-4 w-4 mr-2" />Nova movimentação</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd</TableHead><TableHead>Motivo</TableHead><TableHead>Referência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>}
                    {!movementsLoading && filteredMovements.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhuma movimentação encontrada</TableCell></TableRow>}
                    {filteredMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDateTime(m.createdAt)}</TableCell>
                        <TableCell className="font-medium">{m.productName ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={m.type} /></TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${m.type === "input" ? "text-green-600" : "text-red-500"}`}>{m.type === "input" ? "+" : "-"}{m.quantity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.reason ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.referenceType ?? "—"}{m.referenceId ? ` #${m.referenceId}` : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(movementsData?.totalPages ?? 1) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">Página {movementsData?.page} de {movementsData?.totalPages} — {movementsData?.total} registros</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setMovementsPage((p) => Math.max(1, p - 1))} disabled={movementsPage <= 1}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setMovementsPage((p) => p + 1)} disabled={movementsPage >= (movementsData?.totalPages ?? 1)}>Próxima</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── WAREHOUSES TAB ────────────────────────────────────────── */}
          <TabsContent value="warehouses" className="space-y-4 mt-4">
            <div className="flex justify-end">
              {canEditModule('estoque') && (
                <Button onClick={() => { setEditingWarehouse(null); setWarehouseDialog(true); }}><Plus className="h-4 w-4 mr-2" />Novo depósito</Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">Nenhum depósito cadastrado. Clique em "Novo depósito".</TableCell></TableRow>}
                    {warehouses.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono font-medium text-sm">{w.code}</TableCell>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{w.description ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={w.active === "true" ? "active" : "inactive"} /></TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingWarehouse(w); setWarehouseDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ANÁLISE DE GIRO ───────────────────────────────────────── */}
          <TabsContent value="turnover" className="space-y-4 mt-4">
            {/* ── Filter bar ── */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">De</span>
                    <Input
                      type="date"
                      className="w-36 h-8 text-sm"
                      value={turnoverDateFrom}
                      onChange={(e) => setTurnoverDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Até</span>
                    <Input
                      type="date"
                      className="w-36 h-8 text-sm"
                      value={turnoverDateTo}
                      onChange={(e) => setTurnoverDateTo(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Categoria</span>
                    <Select value={turnoverCategory} onValueChange={setTurnoverCategory}>
                      <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {(turnoverData?.categories ?? []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Inativo há (dias)</span>
                    <Input
                      type="number"
                      min={1}
                      className="w-28 h-8 text-sm"
                      value={turnoverInactiveDays}
                      onChange={(e) => setTurnoverInactiveDays(Math.max(1, parseInt(e.target.value) || 30))}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-0.5">
                    <input
                      id="only-inactive"
                      type="checkbox"
                      className="accent-primary h-4 w-4"
                      checked={turnoverOnlyInactive}
                      onChange={(e) => setTurnoverOnlyInactive(e.target.checked)}
                    />
                    <label htmlFor="only-inactive" className="text-sm cursor-pointer select-none">
                      Somente inativos
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── KPI summary row ── */}
            {turnoverData && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Produtos analisados</CardTitle>
                    <Boxes className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{turnoverData.totalItems}</p>
                    <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Inativos / Dead stock</CardTitle>
                    <AlertOctagon className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-destructive">{turnoverData.inactiveCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Sem mov. há ≥{turnoverData.inactiveDays} dias</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Com movimentação</CardTitle>
                    <Activity className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-emerald-600">{turnoverData.totalItems - turnoverData.inactiveCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Ativos no período</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">% Inativos</CardTitle>
                    <TrendingDown className="h-4 w-4 text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-amber-600">
                      {turnoverData.totalItems > 0
                        ? ((turnoverData.inactiveCount / turnoverData.totalItems) * 100).toFixed(1)
                        : "0.0"}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Do catálogo sem giro</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Table ── */}
            <Card>
              <CardContent className="p-0">
                {turnoverLoading ? (
                  <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <Activity className="h-5 w-5 mr-2 animate-spin" />Carregando análise…
                  </div>
                ) : (() => {
                  const rawItems = turnoverData?.items ?? [];
                  const filtered = turnoverOnlyInactive ? rawItems.filter((i) => i.isInactive) : rawItems;
                  const sorted = [...filtered].sort((a, b) => {
                    const col = turnoverSort.col as keyof typeof a;
                    const av = a[col] ?? 0;
                    const bv = b[col] ?? 0;
                    if (av < bv) return turnoverSort.dir === "asc" ? -1 : 1;
                    if (av > bv) return turnoverSort.dir === "asc" ? 1 : -1;
                    return 0;
                  });

                  function SortIcon({ col }: { col: string }) {
                    if (turnoverSort.col !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
                    return turnoverSort.dir === "asc"
                      ? <ChevronUp className="h-3 w-3 ml-1" />
                      : <ChevronDown className="h-3 w-3 ml-1" />;
                  }
                  function thClick(col: string) {
                    setTurnoverSort((prev) =>
                      prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }
                    );
                  }

                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer select-none" onClick={() => thClick("productName")}>
                            <span className="flex items-center">Produto<SortIcon col="productName" /></span>
                          </TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => thClick("currentStock")}>
                            <span className="flex items-center justify-end">Saldo atual<SortIcon col="currentStock" /></span>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => thClick("totalInputQty")}>
                            <span className="flex items-center justify-end">Entradas<SortIcon col="totalInputQty" /></span>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => thClick("totalOutputQty")}>
                            <span className="flex items-center justify-end">Saídas<SortIcon col="totalOutputQty" /></span>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => thClick("turnoverRate")}>
                            <span className="flex items-center justify-end">Índice de Giro<SortIcon col="turnoverRate" /></span>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => thClick("daysSinceLastMovement")}>
                            <span className="flex items-center justify-end">Dias s/ mov.<SortIcon col="daysSinceLastMovement" /></span>
                          </TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                              Nenhum produto encontrado para os filtros selecionados.
                            </TableCell>
                          </TableRow>
                        )}
                        {sorted.map((item) => (
                          <TableRow key={item.productId} className={item.isInactive ? "bg-destructive/5" : undefined}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</TableCell>
                            <TableCell className="text-sm">{item.category ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(item.currentStock).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {item.unit}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-700">
                              +{Number(item.totalInputQty).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-rose-700">
                              -{Number(item.totalOutputQty).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.avgStock > 0
                                ? <span className={item.turnoverRate < 0.1 ? "text-amber-600 font-medium" : item.turnoverRate >= 1 ? "text-emerald-600 font-medium" : undefined}>
                                    {Number(item.turnoverRate).toFixed(2)}x
                                  </span>
                                : <span className="text-muted-foreground">—</span>
                              }
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.daysSinceLastMovement != null ? (
                                <span className={item.isInactive ? "text-destructive font-medium" : undefined}>
                                  {item.daysSinceLastMovement}d
                                </span>
                              ) : <span className="text-muted-foreground">Nunca</span>}
                            </TableCell>
                            <TableCell>
                              {item.isInactive
                                ? <Badge variant="destructive" className="text-xs">Dead stock</Badge>
                                : <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300">Ativo</Badge>
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      <ProductDialog open={productDialog} onClose={() => { setProductDialog(false); setEditingProduct(null); }} editing={editingProduct} />

      <MovementDialog open={movementDialog} onClose={() => { setMovementDialog(false); setMovementProductId(undefined); }} products={activeProducts} lots={lots} defaultProductId={movementProductId} />

      <LotDialog
        open={lotDialog}
        onClose={() => { setLotDialog(false); setLotDefaultProductId(undefined); }}
        products={activeProducts}
        warehouses={warehouses}
        defaultProductId={lotDefaultProductId}
        fefoLots={lots}
      />

      <AdjustDialog lot={adjustLot} open={!!adjustLot} onClose={() => setAdjustLot(null)} />

      <TransferDialog lot={transferLot} open={!!transferLot} onClose={() => setTransferLot(null)} warehouses={warehouses} />

      <LotDetailSheet
        lot={selectedLot}
        open={!!selectedLot}
        onClose={() => setSelectedLot(null)}
        onAdjust={(l) => { setSelectedLot(null); setAdjustLot(l); }}
        onTransfer={(l) => { setSelectedLot(null); setTransferLot(l); }}
        warehouses={warehouses}
      />

      <LotLabelDialog lotId={labelLotId} onClose={() => setLabelLotId(null)} />

      <WarehouseDialog open={warehouseDialog} onClose={() => { setWarehouseDialog(false); setEditingWarehouse(null); }} editing={editingWarehouse} />

      <AlertDialog open={!!deleteProduct} onOpenChange={(v) => !v && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar produto?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteProduct?.name}" será marcado como inativo. O histórico de movimentações será preservado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate({ id: deleteProduct!.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); qc.invalidateQueries({ queryKey: getGetEstoqueDashboardQueryKey() }); setDeleteProduct(null); } })}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
