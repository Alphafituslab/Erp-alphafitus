import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListStockMovements, useCreateStockMovement, useGetEstoqueDashboard,
  useListWarehouses, useCreateWarehouse, useUpdateWarehouse,
  useListProductLots, useCreateProductLot, useUpdateProductLot,
  useAdjustLotInventory, useTransferLot, useGetLotMovements,
  getListProductsQueryKey, getListStockMovementsQueryKey,
  getGetEstoqueDashboardQueryKey, getListWarehousesQueryKey,
  getListProductLotsQueryKey, getGetLotMovementsQueryKey,
} from "@workspace/api-client-react";
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
  History, CheckCircle2, XCircle, Clock, Shield,
} from "lucide-react";

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
  if (product.currentStock === 0) return "out";
  if (product.currentStock <= product.minStock) return "low";
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
  costPrice: z.string().optional().refine((v) => !v || !isNaN(Number(v)), "Valor inválido"),
  salePrice: z.string().optional().refine((v) => !v || !isNaN(Number(v)), "Valor inválido"),
  minStock: z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Deve ser ≥ 0"),
  currentStock: z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Deve ser ≥ 0"),
});
type ProductForm = z.infer<typeof productSchema>;

function ProductDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Product | null }) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEstoqueDashboardQueryKey() });
  };
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    values: editing
      ? { name: editing.name, sku: editing.sku ?? "", description: editing.description ?? "", category: editing.category ?? "", unit: editing.unit ?? "un", costPrice: editing.costPrice ?? "", salePrice: editing.salePrice ?? "", minStock: String(editing.minStock), currentStock: String(editing.currentStock) }
      : { name: "", sku: "", description: "", category: "", unit: "un", costPrice: "", salePrice: "", minStock: "0", currentStock: "0" },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = { name: data.name, sku: data.sku || null, description: data.description || null, category: data.category || null, unit: data.unit || "un", costPrice: data.costPrice || null, salePrice: data.salePrice || null, minStock: data.minStock ? parseInt(data.minStock) : 0, currentStock: data.currentStock ? parseInt(data.currentStock) : 0 };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input {...form.register("name")} placeholder="Nome do produto" />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">SKU</label>
              <Input {...form.register("sku")} placeholder="ABC-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium">Categoria</label><Input {...form.register("category")} placeholder="Ex: Matéria-Prima" /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Unidade</label><Input {...form.register("unit")} placeholder="un, kg, cx, L…" /></div>
          </div>
          <div className="space-y-1"><label className="text-sm font-medium">Descrição</label><Input {...form.register("description")} placeholder="Opcional" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Preço de custo</label>
              <Input {...form.register("costPrice")} type="number" step="0.01" min="0" placeholder="0,00" />
              {form.formState.errors.costPrice && <p className="text-xs text-destructive">{form.formState.errors.costPrice.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Preço de venda</label>
              <Input {...form.register("salePrice")} type="number" step="0.01" min="0" placeholder="0,00" />
              {form.formState.errors.salePrice && <p className="text-xs text-destructive">{form.formState.errors.salePrice.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Estoque mínimo</label>
              <Input {...form.register("minStock")} type="number" min="0" step="1" />
              {form.formState.errors.minStock && <p className="text-xs text-destructive">{form.formState.errors.minStock.message}</p>}
            </div>
            {!editing && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Estoque inicial</label>
                <Input {...form.register("currentStock")} type="number" min="0" step="1" />
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EstoquePage() {
  const qc = useQueryClient();
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

  // Warehouse state
  const [warehouseDialog, setWarehouseDialog] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const { data: products = [], isLoading: productsLoading } = useListProducts({});
  const { data: movements = [], isLoading: movementsLoading } = useListStockMovements({});
  const { data: dashboard } = useGetEstoqueDashboard();
  const { data: warehouses = [] } = useListWarehouses({});
  const { data: lots = [], isLoading: lotsLoading } = useListProductLots({});

  const deleteMutation = useDeleteProduct();

  const activeProducts = useMemo(() => products.filter((p) => p.active === "true"), [products]);

  const categories = useMemo(() => {
    const cats = new Set(activeProducts.map((p) => p.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    let list = activeProducts;
    if (categoryFilter !== "all") list = list.filter((p) => p.category === categoryFilter);
    if (stockAlertFilter) list = list.filter((p) => stockStatus(p) !== "ok");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [activeProducts, categoryFilter, stockAlertFilter, search]);

  const filteredMovements = useMemo(() => {
    let list = movements;
    if (movTypeFilter !== "all") list = list.filter((m) => m.type === movTypeFilter);
    if (movSearch) {
      const q = movSearch.toLowerCase();
      list = list.filter((m) => (m.productName ?? "").toLowerCase().includes(q) || (m.reason ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [movements, movTypeFilter, movSearch]);

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

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader title="Estoque" subtitle="Produtos, lotes, validade e movimentações" />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="lots">Lotes</TabsTrigger>
            <TabsTrigger value="movements">Movimentações</TabsTrigger>
            <TabsTrigger value="warehouses">Depósitos</TabsTrigger>
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
                <Button onClick={() => { setEditingProduct(null); setProductDialog(true); }}><Plus className="h-4 w-4 mr-2" />Novo produto</Button>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── WAREHOUSES TAB ────────────────────────────────────────── */}
          <TabsContent value="warehouses" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingWarehouse(null); setWarehouseDialog(true); }}><Plus className="h-4 w-4 mr-2" />Novo depósito</Button>
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
