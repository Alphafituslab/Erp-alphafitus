import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useListPurchaseOrders,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useUpdatePurchaseOrderStatus,
  useReceivePurchaseOrder,
  useGetPurchaseOrder,
  useGetComprasDashboard,
  useListProducts,
  getListSuppliersQueryKey,
  getListPurchaseOrdersQueryKey,
  getGetComprasDashboardQueryKey,
} from "@workspace/api-client-react";
import type {
  Supplier,
  PurchaseOrder,
  PurchaseOrderWithItems,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Truck,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  PackageCheck,
  TrendingUp,
  X,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: string | number | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function PoStatusBadge({ status }: { status: string }) {
  if (status === "draft")
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Rascunho
      </Badge>
    );
  if (status === "sent")
    return (
      <Badge
        variant="outline"
        className="gap-1 text-xs border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
      >
        <Send className="h-3 w-3" /> Enviado
      </Badge>
    );
  if (status === "received")
    return (
      <Badge
        variant="outline"
        className="gap-1 text-xs border-green-500 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-400"
      >
        <CheckCircle2 className="h-3 w-3" /> Recebido
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1 text-xs">
      <XCircle className="h-3 w-3" /> Cancelado
    </Badge>
  );
}

// ─── Supplier Dialog ──────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  document: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.trim() === "" || v.replace(/\D/g, "").length === 14,
      "CNPJ deve ter 14 dígitos"
    ),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});
type SupplierForm = z.infer<typeof supplierSchema>;

function SupplierDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Supplier | null;
}) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
  const createM = useCreateSupplier();
  const updateM = useUpdateSupplier();

  const form = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    values: editing
      ? {
          name: editing.name,
          document: editing.document ?? "",
          email: editing.email ?? "",
          phone: editing.phone ?? "",
          address: editing.address ?? "",
          city: editing.city ?? "",
          state: editing.state ?? "",
          category: editing.category ?? "",
          paymentTerms: editing.paymentTerms ?? "",
          notes: editing.notes ?? "",
        }
      : {
          name: "",
          document: "",
          email: "",
          phone: "",
          address: "",
          city: "",
          state: "",
          category: "",
          paymentTerms: "",
          notes: "",
        },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      name: data.name,
      document: data.document || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      category: data.category || null,
      paymentTerms: data.paymentTerms || null,
      notes: data.notes || null,
    };
    if (editing) {
      updateM.mutate(
        { id: editing.id, data: payload },
        { onSuccess: () => { invalidate(); onClose(); } }
      );
    } else {
      createM.mutate(
        { data: payload },
        { onSuccess: () => { invalidate(); onClose(); form.reset(); } }
      );
    }
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Razão Social / Nome *</label>
              <Input {...form.register("name")} placeholder="Nome do fornecedor" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">CNPJ / CPF</label>
              <Input {...form.register("document")} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoria</label>
              <Input {...form.register("category")} placeholder="Ex: Matéria-prima, Serviço…" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">E-mail</label>
              <Input {...form.register("email")} type="email" placeholder="contato@fornecedor.com" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Telefone</label>
              <Input {...form.register("phone")} placeholder="(11) 99999-0000" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Endereço</label>
              <Input {...form.register("address")} placeholder="Rua, nº, complemento" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cidade</label>
              <Input {...form.register("city")} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Estado</label>
              <Input {...form.register("state")} placeholder="SP" maxLength={2} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Prazo de pagamento</label>
              <Input {...form.register("paymentTerms")} placeholder="Ex: 30/60/90 dias, À vista…" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Observações</label>
              <Input {...form.register("notes")} placeholder="Opcional" />
            </div>
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

// ─── Purchase Order Dialog ────────────────────────────────────────────────────

const poItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, "Obrigatório"),
  quantity: z.string().min(1, "Obrigatório"),
  unitPrice: z.string().min(1, "Obrigatório"),
});

const poSchema = z.object({
  supplierId: z.string().min(1, "Selecione um fornecedor"),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(poItemSchema).min(1, "Adicione pelo menos um item"),
});
type PoForm = z.infer<typeof poSchema>;

function PurchaseOrderDialog({
  open,
  onClose,
  editing,
  suppliers,
  products,
}: {
  open: boolean;
  onClose: () => void;
  editing?: PurchaseOrderWithItems | null;
  suppliers: Supplier[];
  products: Array<{ id: number; name: string; sku?: string | null }>;
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetComprasDashboardQueryKey() });
  };
  const createM = useCreatePurchaseOrder();
  const updateM = useUpdatePurchaseOrder();

  const defaultItems = editing?.items?.map((i) => ({
    productId: i.productId ? String(i.productId) : "",
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  })) ?? [{ productId: "", description: "", quantity: "1", unitPrice: "0" }];

  const form = useForm<PoForm>({
    resolver: zodResolver(poSchema),
    values: editing
      ? {
          supplierId: String(editing.supplierId),
          expectedDeliveryDate: editing.expectedDeliveryDate
            ? new Date(editing.expectedDeliveryDate).toISOString().slice(0, 10)
            : "",
          notes: editing.notes ?? "",
          items: defaultItems,
        }
      : {
          supplierId: "",
          expectedDeliveryDate: "",
          notes: "",
          items: [{ productId: "", description: "", quantity: "1", unitPrice: "0" }],
        },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const watchItems = form.watch("items");
  const total = watchItems.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unitPrice) || 0;
    return sum + q * p;
  }, 0);

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      supplierId: parseInt(data.supplierId),
      expectedDeliveryDate: data.expectedDeliveryDate
        ? new Date(data.expectedDeliveryDate).toISOString()
        : null,
      notes: data.notes || null,
      items: data.items.map((item) => ({
        productId: item.productId ? parseInt(item.productId) : null,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
      })),
    };
    if (editing) {
      updateM.mutate(
        { id: editing.id, data: payload },
        { onSuccess: () => { invalidate(); onClose(); } }
      );
    } else {
      createM.mutate(
        { data: payload },
        { onSuccess: () => { invalidate(); onClose(); form.reset(); } }
      );
    }
  });

  const isPending = createM.isPending || updateM.isPending;

  // Auto-fill description from product selection
  const handleProductSelect = (idx: number, productId: string) => {
    // "none" sentinel means "no product selected" — store as empty string
    const value = productId === "none" ? "" : productId;
    form.setValue(`items.${idx}.productId`, value);
    if (value) {
      const p = products.find((pr) => String(pr.id) === value);
      if (p && !form.getValues(`items.${idx}.description`)) {
        form.setValue(`items.${idx}.description`, p.name);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Editar PC #${editing.id}` : "Novo Pedido de Compra"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Fornecedor *</label>
              <Controller
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.supplierId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.supplierId.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Previsão de entrega</label>
              <Input {...form.register("expectedDeliveryDate")} type="date" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Observações</label>
              <Input {...form.register("notes")} placeholder="Opcional" />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Itens do pedido</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  append({ productId: "", description: "", quantity: "1", unitPrice: "0" })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[180px]">Produto</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[80px]">Qtd.</TableHead>
                    <TableHead className="w-[110px]">Preço unit.</TableHead>
                    <TableHead className="w-[110px] text-right">Total</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, idx) => {
                    const q = parseFloat(watchItems[idx]?.quantity ?? "0") || 0;
                    const p = parseFloat(watchItems[idx]?.unitPrice ?? "0") || 0;
                    return (
                      <TableRow key={field.id}>
                        <TableCell className="py-1.5 pl-3">
                          <Controller
                            control={form.control}
                            name={`items.${idx}.productId`}
                            render={({ field: f }) => (
                              <Select
                                value={f.value || "none"}
                                onValueChange={(v) => handleProductSelect(idx, v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Produto…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Nenhum —</SelectItem>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            {...form.register(`items.${idx}.description`)}
                            className="h-8 text-xs"
                            placeholder="Descrição"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            {...form.register(`items.${idx}.quantity`)}
                            className="h-8 text-xs text-right"
                            type="number"
                            min="0.001"
                            step="0.001"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            {...form.register(`items.${idx}.unitPrice`)}
                            className="h-8 text-xs text-right"
                            type="number"
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-sm tabular-nums font-medium">
                          {fmtCurrency(q * p)}
                        </TableCell>
                        <TableCell className="py-1.5 pr-2">
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => remove(idx)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex justify-end px-4 py-2 border-t bg-muted/20 text-sm font-semibold">
                Total: {fmtCurrency(total)}
              </div>
            </div>
            {form.formState.errors.items && (
              <p className="text-xs text-destructive">
                {typeof form.formState.errors.items === "object" && "message" in form.formState.errors.items
                  ? (form.formState.errors.items as any).message
                  : "Preencha todos os itens"}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── PO Detail Modal ──────────────────────────────────────────────────────────

function PurchaseOrderDetailDialog({
  orderId,
  onClose,
  onReceive,
  onStatusChange,
}: {
  orderId: number | null;
  onClose: () => void;
  onReceive: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const { data: order, isLoading } = useGetPurchaseOrder(orderId ?? 0, {
    query: { enabled: orderId !== null } as any,
  });

  if (!orderId) return null;

  return (
    <Dialog open={orderId !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            PC #{orderId}
            {order && <PoStatusBadge status={order.status} />}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-6 text-center">Carregando…</p>
        ) : order ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Fornecedor</span>
                <p className="font-medium">{order.supplierName ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Previsão de entrega</span>
                <p className="font-medium">{fmtDate(order.expectedDeliveryDate)}</p>
              </div>
              {order.receivedAt && (
                <div>
                  <span className="text-muted-foreground">Recebido em</span>
                  <p className="font-medium">{fmtDateTime(order.receivedAt)}</p>
                </div>
              )}
              {order.notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Observações</span>
                  <p>{order.notes}</p>
                </div>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right w-[70px]">Qtd.</TableHead>
                    <TableHead className="text-right w-[110px]">Preço unit.</TableHead>
                    <TableHead className="text-right w-[110px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {parseFloat(item.quantity).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {fmtCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">
                        {fmtCurrency(item.totalPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end px-4 py-2 border-t bg-muted/20 text-sm font-semibold">
                Total: {fmtCurrency(order.totalAmount)}
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2">
              {order.status === "draft" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(order.id, "sent")}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Marcar como Enviado
                </Button>
              )}
              {order.status === "sent" && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => onReceive(order.id)}
                >
                  <PackageCheck className="h-3.5 w-3.5 mr-1.5" /> Confirmar Recebimento
                </Button>
              )}
              {(order.status === "draft" || order.status === "sent") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onStatusChange(order.id, "cancelled")}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar pedido
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("dashboard");

  // Supplier state
  const [suppSearch, setSupplSearch] = useState("");
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);

  // PO state
  const [poStatusFilter, setPoStatusFilter] = useState("all");
  const [poSearch, setPoSearch] = useState("");
  const [poDialog, setPoDialog] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrderWithItems | null>(null);
  const [viewPoId, setViewPoId] = useState<number | null>(null);
  const [editLoadPoId, setEditLoadPoId] = useState<number | null>(null);
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [deletePo, setDeletePo] = useState<PurchaseOrder | null>(null);

  const { data: suppliers = [], isLoading: supplLoading } = useListSuppliers({});
  const { data: orders = [], isLoading: ordersLoading } = useListPurchaseOrders({});
  const { data: dashboard } = useGetComprasDashboard();
  const { data: products = [] } = useListProducts({});

  // Load full PO with items when user clicks "Edit" on a draft order
  const { data: editLoadPoData } = useGetPurchaseOrder(editLoadPoId ?? 0, {
    query: { enabled: editLoadPoId !== null } as any,
  });
  useEffect(() => {
    if (editLoadPoData && editLoadPoId !== null) {
      setEditingPo(editLoadPoData as PurchaseOrderWithItems);
      setPoDialog(true);
      setEditLoadPoId(null);
    }
  }, [editLoadPoData, editLoadPoId]);

  const deleteSupplierM = useDeleteSupplier();
  const deletePoM = useDeletePurchaseOrder();
  const statusM = useUpdatePurchaseOrderStatus();
  const receiveM = useReceivePurchaseOrder();

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.active === "true"),
    [suppliers]
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.active === "true"),
    [products]
  );

  const filteredSuppliers = useMemo(() => {
    if (!suppSearch) return activeSuppliers;
    const q = suppSearch.toLowerCase();
    return activeSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.document ?? "").toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q)
    );
  }, [activeSuppliers, suppSearch]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (poStatusFilter !== "all") list = list.filter((o) => o.status === poStatusFilter);
    if (poSearch) {
      const q = poSearch.toLowerCase();
      list = list.filter(
        (o) =>
          String(o.id).includes(q) ||
          (o.supplierName ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, poStatusFilter, poSearch]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetComprasDashboardQueryKey() });
  };

  const handleReceive = (id: number) => {
    receiveM.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateAll();
          setReceivePo(null);
          setViewPoId(null);
        },
      }
    );
  };

  const handleStatusChange = (id: number, status: string) => {
    statusM.mutate(
      { id, data: { status: status as any } },
      {
        onSuccess: () => {
          invalidateAll();
          setViewPoId(null);
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Compras"
          subtitle="Fornecedores, pedidos de compra e recebimento de mercadorias"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="orders">Pedidos de Compra</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Gasto este mês
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {fmtCurrency(dashboard?.totalSpentThisMonth ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Pedidos recebidos</p>
                </CardContent>
              </Card>

              <Card
                className={
                  (dashboard?.sentCount ?? 0) > 0
                    ? "cursor-pointer hover:border-blue-400 transition-colors"
                    : ""
                }
                onClick={() => {
                  if ((dashboard?.sentCount ?? 0) > 0) {
                    setPoStatusFilter("sent");
                    setActiveTab("orders");
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Aguardando entrega
                  </CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${(dashboard?.sentCount ?? 0) > 0 ? "text-blue-600" : ""}`}>
                    {dashboard?.sentCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(dashboard?.sentCount ?? 0) > 0 ? "Clique para ver" : "Nenhum pendente"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Rascunhos
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{dashboard?.draftCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">PC não enviados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Recebidos totais
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-green-600">
                    {dashboard?.receivedCount ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Pedidos concluídos</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pending deliveries */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Entregas pendentes</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEditingPo(null); setPoDialog(true); }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Novo PC
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {(dashboard?.pendingDeliveries ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">
                      Nenhuma entrega pendente ✓
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Entrega prevista</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dashboard?.pendingDeliveries ?? []).map((o) => (
                          <TableRow
                            key={o.id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => setViewPoId(o.id)}
                          >
                            <TableCell className="text-muted-foreground font-mono text-sm">
                              #{o.id}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {o.supplierName ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {fmtDate(o.expectedDeliveryDate)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {fmtCurrency(o.totalAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Top suppliers */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Top Fornecedores
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {(dashboard?.topSuppliers ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                  )}
                  {(dashboard?.topSuppliers ?? []).map((s, i) => (
                    <div key={s.supplierId ?? i} className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm w-4 shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.supplierName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{s.orderCount} pedidos</p>
                      </div>
                      <p className="text-sm font-semibold shrink-0">{fmtCurrency(s.totalSpent)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Monthly spend */}
            {(dashboard?.monthlySpend ?? []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gastos mensais (recebidos)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-32">
                    {(() => {
                      const data = dashboard?.monthlySpend ?? [];
                      const maxVal = Math.max(...data.map((d) => d.total), 1);
                      return data.map((d) => {
                        const pct = Math.round((d.total / maxVal) * 100);
                        const [, mm] = d.month.split("-");
                        const monthName = new Date(2024, parseInt(mm!) - 1).toLocaleString("pt-BR", { month: "short" });
                        return (
                          <div key={d.month} className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-xs text-muted-foreground">
                              {fmtCurrency(d.total)}
                            </span>
                            <div
                              className="w-full rounded-t-sm bg-primary/70 transition-all"
                              style={{ height: `${Math.max(pct, 4)}%` }}
                            />
                            <span className="text-xs text-muted-foreground capitalize">
                              {monthName}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── PURCHASE ORDERS TAB ───────────────────────────────────────── */}
          <TabsContent value="orders" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <Input
                  className="w-48"
                  placeholder="Buscar fornecedor, #…"
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                />
                <Select value={poStatusFilter} onValueChange={setPoStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="received">Recebido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { setEditingPo(null); setPoDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo pedido
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entrega prevista</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!ordersLoading && filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                          Nenhum pedido encontrado
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          #{o.id}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {o.supplierName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <PoStatusBadge status={o.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {fmtDate(o.expectedDeliveryDate)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">
                          {fmtCurrency(o.totalAmount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {fmtDate(o.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Ver detalhes"
                              onClick={() => setViewPoId(o.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {o.status === "sent" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                title="Confirmar recebimento"
                                onClick={() => setReceivePo(o)}
                              >
                                <PackageCheck className="h-4 w-4" />
                              </Button>
                            )}
                            {o.status === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Editar"
                                  onClick={() => {
                                    setEditingPo(null);
                                    setPoDialog(false);
                                    setEditLoadPoId(o.id);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Cancelar"
                                  onClick={() => setDeletePo(o)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SUPPLIERS TAB ─────────────────────────────────────────────── */}
          <TabsContent value="suppliers" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <Input
                className="w-60"
                placeholder="Buscar nome, CNPJ, categoria…"
                value={suppSearch}
                onChange={(e) => setSupplSearch(e.target.value)}
              />
              <Button onClick={() => { setEditingSupplier(null); setSupplierDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo fornecedor
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Prazo pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!supplLoading && filteredSuppliers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          Nenhum fornecedor cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredSuppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{s.name}</div>
                          {s.city && (
                            <div className="text-xs text-muted-foreground">
                              {s.city}{s.state ? ` / ${s.state}` : ""}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {s.document ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.category ?? "—"}
                        </TableCell>
                        <TableCell>
                          {s.email && (
                            <div className="text-sm text-muted-foreground">{s.email}</div>
                          )}
                          {s.phone && (
                            <div className="text-sm text-muted-foreground">{s.phone}</div>
                          )}
                          {!s.email && !s.phone && "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.paymentTerms ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setEditingSupplier(s); setSupplierDialog(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteSupplier(s)}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      <SupplierDialog
        open={supplierDialog}
        onClose={() => { setSupplierDialog(false); setEditingSupplier(null); }}
        editing={editingSupplier}
      />

      <PurchaseOrderDialog
        open={poDialog}
        onClose={() => { setPoDialog(false); setEditingPo(null); }}
        editing={editingPo}
        suppliers={activeSuppliers}
        products={activeProducts}
      />

      <PurchaseOrderDetailDialog
        orderId={viewPoId}
        onClose={() => setViewPoId(null)}
        onReceive={handleReceive}
        onStatusChange={handleStatusChange}
      />

      {/* Confirm receive */}
      <AlertDialog open={!!receivePo} onOpenChange={(v) => !v && setReceivePo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O PC #{receivePo?.id} ({receivePo?.supplierName ?? "fornecedor"}) será marcado como
              recebido e as entradas de estoque serão registradas automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => receivePo && handleReceive(receivePo.id)}
            >
              Confirmar recebimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel PO */}
      <AlertDialog open={!!deletePo} onOpenChange={(v) => !v && setDeletePo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O PC #{deletePo?.id} será cancelado. Esta ação pode ser revertida editando o status
              novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deletePoM.mutate(
                  { id: deletePo!.id },
                  {
                    onSuccess: () => {
                      invalidateAll();
                      setDeletePo(null);
                    },
                  }
                )
              }
            >
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete supplier */}
      <AlertDialog
        open={!!deleteSupplier}
        onOpenChange={(v) => !v && setDeleteSupplier(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteSupplier?.name}" será desativado e não aparecerá mais na lista. Os pedidos
              existentes permanecem intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteSupplierM.mutate(
                  { id: deleteSupplier!.id },
                  {
                    onSuccess: () => {
                      qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
                      setDeleteSupplier(null);
                    },
                  }
                )
              }
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
