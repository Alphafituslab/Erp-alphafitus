import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useUpdateSupplierApproval,
  useListPurchaseOrders,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useUpdatePurchaseOrderStatus,
  useReceivePurchaseOrder,
  useGetPurchaseOrder,
  useGetComprasDashboard,
  useListProducts,
  useListPurchaseRequests,
  useCreatePurchaseRequest,
  useUpdatePurchaseRequest,
  useApprovePurchaseRequest,
  useRejectPurchaseRequest,
  useListQuotations,
  useCreateQuotation,
  useUpdateQuotation,
  useSelectQuotationWinner,
  useGetPriceHistory,
  useListWarehouses,
  getPurchaseOrder,
  getListSuppliersQueryKey,
  getListPurchaseOrdersQueryKey,
  getGetComprasDashboardQueryKey,
  getListPurchaseRequestsQueryKey,
  getListQuotationsQueryKey,
} from "@workspace/api-client-react";
import type {
  Supplier,
  PurchaseOrder,
  PurchaseOrderWithItems,
  PurchaseRequest,
  QuotationWithItems,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  AlertTriangle,
  ClipboardList,
  Scale,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  History,
  ChevronRight,
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

function priorityLabel(p: string) {
  if (p === "urgent") return "Urgente";
  if (p === "critical") return "Crítico";
  return "Normal";
}

function priorityColor(p: string) {
  if (p === "critical") return "destructive";
  if (p === "urgent") return "secondary";
  return "outline";
}

function approvalBadge(status: string) {
  if (status === "blocked") return <Badge variant="destructive" className="text-xs gap-1"><ShieldX className="h-3 w-3" />Bloqueado</Badge>;
  if (status === "pending") return <Badge variant="secondary" className="text-xs gap-1"><ShieldAlert className="h-3 w-3" />Pendente</Badge>;
  return <Badge variant="outline" className="text-xs gap-1 text-green-700 border-green-300"><ShieldCheck className="h-3 w-3" />Aprovado</Badge>;
}

// ─── Supplier Dialog ──────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  document: z.string().optional(),
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
  const invalidate = () => qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
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
      : { name: "", document: "", email: "", phone: "", address: "", city: "", state: "", category: "", paymentTerms: "", notes: "" },
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
      updateM.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createM.mutate({ data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });

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
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
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
              <Input {...form.register("email")} type="email" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Telefone</label>
              <Input {...form.register("phone")} placeholder="(11) 99999-0000" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Endereço</label>
              <Input {...form.register("address")} />
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
              <Input {...form.register("notes")} />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending || updateM.isPending}>
              {createM.isPending || updateM.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Purchase Request Dialog ───────────────────────────────────────────────────

const reqSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, "Obrigatório"),
  quantity: z.string().min(1, "Obrigatório"),
  unit: z.string().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
});
type ReqForm = z.infer<typeof reqSchema>;

function PurchaseRequestDialog({
  open,
  onClose,
  editing,
  products,
}: {
  open: boolean;
  onClose: () => void;
  editing?: PurchaseRequest | null;
  products: Array<{ id: number; name: string }>;
}) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListPurchaseRequestsQueryKey() });
  const createM = useCreatePurchaseRequest();
  const updateM = useUpdatePurchaseRequest();

  const form = useForm<ReqForm>({
    resolver: zodResolver(reqSchema),
    values: editing
      ? {
          productId: editing.productId ? String(editing.productId) : "",
          description: editing.description,
          quantity: editing.quantity,
          unit: editing.unit ?? "un",
          priority: editing.priority ?? "normal",
          notes: editing.notes ?? "",
        }
      : { productId: "", description: "", quantity: "1", unit: "un", priority: "normal", notes: "" },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      productId: data.productId ? parseInt(data.productId) : null,
      description: data.description,
      quantity: parseFloat(data.quantity),
      unit: data.unit || "un",
      priority: (data.priority as any) || "normal",
      notes: data.notes || null,
    };
    if (editing) {
      updateM.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createM.mutate({ data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Solicitação" : "Nova Solicitação de Compra"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Produto (opcional)</label>
            <Controller
              control={form.control}
              name="productId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => {
                  const val = v === "none" ? "" : v;
                  field.onChange(val);
                  if (val) {
                    const p = products.find((pr) => String(pr.id) === val);
                    if (p && !form.getValues("description")) form.setValue("description", p.name);
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição *</label>
            <Input {...form.register("description")} placeholder="O que precisa ser comprado" />
            {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Quantidade *</label>
              <Input {...form.register("quantity")} type="number" min="0.001" step="0.001" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Unidade</label>
              <Input {...form.register("unit")} placeholder="un, kg, L…" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Prioridade</label>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value || "normal"} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Observações</label>
            <Input {...form.register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending || updateM.isPending}>
              {createM.isPending || updateM.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quotation Dialog ──────────────────────────────────────────────────────────

const quotItemSchema = z.object({
  supplierId: z.string().min(1, "Obrigatório"),
  productId: z.string().optional(),
  description: z.string().min(1, "Obrigatório"),
  quantity: z.string().min(1, "Obrigatório"),
  unitPrice: z.string().min(1, "Obrigatório"),
  deliveryDays: z.string().optional(),
  notes: z.string().optional(),
});

const quotSchema = z.object({
  purchaseRequestId: z.string().optional(),
  title: z.string().min(1, "Obrigatório"),
  notes: z.string().optional(),
  items: z.array(quotItemSchema).min(1, "Adicione pelo menos uma proposta"),
});
type QuotForm = z.infer<typeof quotSchema>;

function QuotationDialog({
  open,
  onClose,
  suppliers,
  products,
  requests,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Array<{ id: number; name: string }>;
  requests: PurchaseRequest[];
}) {
  const qc = useQueryClient();
  const createM = useCreateQuotation();

  const form = useForm<QuotForm>({
    resolver: zodResolver(quotSchema),
    defaultValues: {
      purchaseRequestId: "",
      title: "",
      notes: "",
      items: [{ supplierId: "", productId: "", description: "", quantity: "1", unitPrice: "0", deliveryDays: "", notes: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const watchItems = form.watch("items");

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      purchaseRequestId: data.purchaseRequestId ? parseInt(data.purchaseRequestId) : null,
      title: data.title,
      notes: data.notes || null,
      items: data.items.map((item) => ({
        supplierId: parseInt(item.supplierId),
        productId: item.productId ? parseInt(item.productId) : null,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        deliveryDays: item.deliveryDays ? parseInt(item.deliveryDays) : null,
        notes: item.notes || null,
      })),
    };
    createM.mutate({ data: payload }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
        onClose();
        form.reset();
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cotação Multi-Fornecedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Título *</label>
              <Input {...form.register("title")} placeholder="Ex: Cotação de Insumo X – Jun/2026" />
              {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Solicitação de compra (opcional)</label>
              <Controller
                control={form.control}
                name="purchaseRequestId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Vincular solicitação…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhuma —</SelectItem>
                      {requests.filter((r) => r.status === "pending" || r.status === "approved").map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>SC #{r.id} — {r.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Observações</label>
              <Input {...form.register("notes")} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Propostas de fornecedores</label>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => append({ supplierId: "", productId: "", description: "", quantity: "1", unitPrice: "0", deliveryDays: "", notes: "" })}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar proposta
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[160px]">Fornecedor *</TableHead>
                    <TableHead>Descrição *</TableHead>
                    <TableHead className="w-[70px]">Qtd.</TableHead>
                    <TableHead className="w-[100px]">Preço unit.</TableHead>
                    <TableHead className="w-[70px]">Prazo (d)</TableHead>
                    <TableHead className="w-[30px]"></TableHead>
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
                            name={`items.${idx}.supplierId`}
                            render={({ field: f }) => (
                              <Select value={f.value || "none"} onValueChange={(v) => f.onChange(v === "none" ? "" : v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Fornecedor…" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Selecione —</SelectItem>
                                  {suppliers.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input {...form.register(`items.${idx}.description`)} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input {...form.register(`items.${idx}.quantity`)} className="h-8 text-xs text-right" type="number" min="0.001" step="0.001" />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input {...form.register(`items.${idx}.unitPrice`)} className="h-8 text-xs text-right" type="number" min="0" step="0.01" />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input {...form.register(`items.${idx}.deliveryDays`)} className="h-8 text-xs text-center" type="number" min="0" />
                        </TableCell>
                        <TableCell className="py-1.5 pr-2">
                          {fields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(idx)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending}>{createM.isPending ? "Salvando…" : "Criar cotação"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quotation Detail / Select Winner ─────────────────────────────────────────

function QuotationDetailSheet({
  quotation,
  onClose,
  onWinnerSelected,
}: {
  quotation: QuotationWithItems | null;
  onClose: () => void;
  onWinnerSelected: () => void;
}) {
  const qc = useQueryClient();
  const selectM = useSelectQuotationWinner();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");

  if (!quotation) return null;

  const sorted = [...(quotation.items ?? [])].sort(
    (a, b) => parseFloat(a.unitPrice) - parseFloat(b.unitPrice)
  );
  const minPrice = sorted.length > 0 ? parseFloat(sorted[0]!.unitPrice) : 0;

  const handleSelect = () => {
    if (!selectedItemId) return;
    selectM.mutate(
      {
        id: quotation.id,
        data: {
          quotationItemId: selectedItemId,
          expectedDeliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : null,
          notes: null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
          qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
          qc.invalidateQueries({ queryKey: getGetComprasDashboardQueryKey() });
          onWinnerSelected();
          onClose();
        },
      }
    );
  };

  return (
    <Sheet open={!!quotation} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="min-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Cotação #{quotation.id} — {quotation.title}
            <Badge className="ml-2 capitalize" variant={quotation.status === "open" ? "secondary" : "outline"}>
              {quotation.status === "open" ? "Aberta" : quotation.status === "closed" ? "Fechada" : "Cancelada"}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {quotation.notes && (
            <p className="text-sm text-muted-foreground">{quotation.notes}</p>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Preço unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Prazo (d)</TableHead>
                  {quotation.status === "open" && <TableHead className="text-center">Selecionar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.items.map((item) => {
                  const isLowest = parseFloat(item.unitPrice) === minPrice;
                  const isSelected = item.selected === "true";
                  return (
                    <TableRow
                      key={item.id}
                      className={isSelected ? "bg-green-50 dark:bg-green-950/20" : isLowest ? "bg-blue-50/50 dark:bg-blue-950/10" : ""}
                    >
                      <TableCell className="text-sm font-medium">
                        {item.supplierName ?? "—"}
                        {isSelected && <Badge className="ml-1 text-xs" variant="default">Vencedor</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {parseFloat(item.quantity).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">
                        <span className={isLowest ? "text-blue-700" : ""}>{fmtCurrency(item.unitPrice)}</span>
                        {isLowest && !isSelected && (
                          <span className="ml-1 text-xs text-blue-600 font-normal">✓ menor</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {fmtCurrency(parseFloat(item.unitPrice) * parseFloat(item.quantity))}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {item.deliveryDays ?? "—"}
                      </TableCell>
                      {quotation.status === "open" && (
                        <TableCell className="text-center">
                          <input
                            type="radio"
                            name="winner"
                            className="h-4 w-4 cursor-pointer"
                            checked={selectedItemId === item.id}
                            onChange={() => setSelectedItemId(item.id)}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {quotation.status === "open" && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-medium">Selecionar vencedor e gerar PC</p>
              <div className="flex gap-3 items-end">
                <div className="space-y-1 flex-1">
                  <label className="text-xs text-muted-foreground">Previsão de entrega</label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
                <Button
                  onClick={handleSelect}
                  disabled={!selectedItemId || selectM.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <PackageCheck className="h-4 w-4 mr-2" />
                  {selectM.isPending ? "Gerando PC…" : "Gerar Pedido de Compra"}
                </Button>
              </div>
              {!selectedItemId && (
                <p className="text-xs text-muted-foreground">Selecione um fornecedor vencedor acima.</p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Receive Dialog ────────────────────────────────────────────────────────────

function ReceiveDialog({
  order,
  warehouses,
  onClose,
  onReceive,
}: {
  order: PurchaseOrderWithItems | null;
  warehouses: Array<{ id: number; name: string; code: string }>;
  onClose: () => void;
  onReceive: (data: {
    nfNumber?: string;
    carrier?: string;
    freightCost?: number;
    items: Array<{ itemId: number; receivedQty: number; supplierLot?: string; expiryDate?: string; manufactureDate?: string; warehouseId?: number }>;
  }) => void;
}) {
  const [nfNumber, setNfNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [itemDetails, setItemDetails] = useState<
    Record<number, { receivedQty: string; supplierLot: string; expiryDate: string; manufactureDate: string; warehouseId: string }>
  >({});

  useEffect(() => {
    if (order) {
      const initial: typeof itemDetails = {};
      for (const item of order.items ?? []) {
        initial[item.id] = {
          receivedQty: item.quantity,
          supplierLot: "",
          expiryDate: "",
          manufactureDate: "",
          warehouseId: "",
        };
      }
      setItemDetails(initial);
      setNfNumber("");
      setCarrier("");
      setFreightCost("");
    }
  }, [order?.id]);

  if (!order) return null;

  const handleSubmit = () => {
    onReceive({
      nfNumber: nfNumber || undefined,
      carrier: carrier || undefined,
      freightCost: freightCost ? parseFloat(freightCost) : undefined,
      items: (order.items ?? []).map((item) => {
        const d = itemDetails[item.id];
        return {
          itemId: item.id,
          receivedQty: parseFloat(d?.receivedQty ?? item.quantity) || parseFloat(item.quantity),
          supplierLot: d?.supplierLot || undefined,
          expiryDate: d?.expiryDate || undefined,
          manufactureDate: d?.manufactureDate || undefined,
          warehouseId: d?.warehouseId ? parseInt(d.warehouseId) : undefined,
        };
      }),
    });
  };

  const updateItem = (itemId: number, field: string, value: string) => {
    setItemDetails((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { receivedQty: "", supplierLot: "", expiryDate: "", manufactureDate: "", warehouseId: "" }), [field]: value },
    }));
  };

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Recebimento — PC #{order.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Número da NF</label>
              <Input value={nfNumber} onChange={(e) => setNfNumber(e.target.value)} placeholder="NF-12345" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Transportadora</label>
              <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Nome da transportadora" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Frete (R$)</label>
              <Input value={freightCost} onChange={(e) => setFreightCost(e.target.value)} type="number" min="0" step="0.01" placeholder="0,00" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Itens — conferência e dados de lote</p>
            {(order.items ?? []).map((item) => {
              const d = itemDetails[item.id] ?? { receivedQty: item.quantity, supplierLot: "", expiryDate: "", manufactureDate: "", warehouseId: "" };
              return (
                <div key={item.id} className="border rounded-lg p-3 space-y-2 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.description}</p>
                    <span className="text-xs text-muted-foreground">PC: {parseFloat(item.quantity).toLocaleString("pt-BR")} un — {fmtCurrency(item.unitPrice)}/un</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Qtd. recebida</label>
                      <Input
                        value={d.receivedQty}
                        onChange={(e) => updateItem(item.id, "receivedQty", e.target.value)}
                        type="number" min="0" step="1" className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Lote do fornecedor</label>
                      <Input
                        value={d.supplierLot}
                        onChange={(e) => updateItem(item.id, "supplierLot", e.target.value)}
                        placeholder="LOT-XXX" className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Data de validade</label>
                      <Input
                        value={d.expiryDate}
                        onChange={(e) => updateItem(item.id, "expiryDate", e.target.value)}
                        type="date" className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Fabricação</label>
                      <Input
                        value={d.manufactureDate}
                        onChange={(e) => updateItem(item.id, "manufactureDate", e.target.value)}
                        type="date" className="h-8 text-sm"
                      />
                    </div>
                    {warehouses.length > 0 && (
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-muted-foreground">Depósito destino</label>
                        <Select value={d.warehouseId || "none"} onValueChange={(v) => updateItem(item.id, "warehouseId", v === "none" ? "" : v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Depósito…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Padrão —</SelectItem>
                            {warehouses.map((w) => (
                              <SelectItem key={w.id} value={String(w.id)}>{w.name} ({w.code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Os itens serão recebidos em lote de <strong>quarentena</strong>. O CQ deverá aprovar cada lote para liberação ao estoque disponível.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
            <PackageCheck className="h-4 w-4 mr-2" /> Confirmar Recebimento
          </Button>
        </DialogFooter>
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
  freightCost: z.string().optional(),
  carrier: z.string().optional(),
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
          freightCost: editing.freightCost ?? "",
          carrier: editing.carrier ?? "",
          items: defaultItems,
        }
      : { supplierId: "", expectedDeliveryDate: "", notes: "", freightCost: "", carrier: "", items: [{ productId: "", description: "", quantity: "1", unitPrice: "0" }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const watchItems = form.watch("items");
  const total = watchItems.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
  }, 0);

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      supplierId: parseInt(data.supplierId),
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate).toISOString() : null,
      notes: data.notes || null,
      freightCost: data.freightCost ? parseFloat(data.freightCost) : null,
      carrier: data.carrier || null,
      items: data.items.map((item) => ({
        productId: item.productId ? parseInt(item.productId) : null,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
      })),
    };
    if (editing) {
      updateM.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createM.mutate({ data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });

  const handleProductSelect = (idx: number, productId: string) => {
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
          <DialogTitle>{editing ? `Editar PC #${editing.id}` : "Novo Pedido de Compra"}</DialogTitle>
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
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.filter((s) => s.approvalStatus !== "blocked").map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}{s.approvalStatus === "pending" ? " ⚠" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.supplierId && <p className="text-xs text-destructive">{form.formState.errors.supplierId.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Previsão de entrega</label>
              <Input {...form.register("expectedDeliveryDate")} type="date" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Transportadora</label>
              <Input {...form.register("carrier")} placeholder="Nome da transportadora" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Frete (R$)</label>
              <Input {...form.register("freightCost")} type="number" min="0" step="0.01" placeholder="0,00" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium">Observações</label>
              <Input {...form.register("notes")} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Itens do pedido</label>
              <Button type="button" size="sm" variant="outline"
                onClick={() => append({ productId: "", description: "", quantity: "1", unitPrice: "0" })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[160px]">Produto</TableHead>
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
                              <Select value={f.value || "none"} onValueChange={(v) => handleProductSelect(idx, v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto…" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Nenhum —</SelectItem>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input {...form.register(`items.${idx}.description`)} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input {...form.register(`items.${idx}.quantity`)} className="h-8 text-xs text-right" type="number" min="0.001" step="0.001" />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input {...form.register(`items.${idx}.unitPrice`)} className="h-8 text-xs text-right" type="number" min="0" step="0.01" />
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-sm tabular-nums font-medium">
                          {fmtCurrency(q * p)}
                        </TableCell>
                        <TableCell className="py-1.5 pr-2">
                          {fields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(idx)}>
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
                Total itens: {fmtCurrency(total)}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending || updateM.isPending}>
              {createM.isPending || updateM.isPending ? "Salvando…" : "Salvar pedido"}
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
  onReceive: (order: PurchaseOrderWithItems) => void;
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
            {order && <StatusBadge status={order.status} />}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-6 text-center">Carregando…</p>
        ) : order ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Fornecedor</span><p className="font-medium">{order.supplierName ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Previsão de entrega</span><p className="font-medium">{fmtDate(order.expectedDeliveryDate)}</p></div>
              {order.nfNumber && <div><span className="text-muted-foreground">Nota Fiscal</span><p className="font-medium">{order.nfNumber}</p></div>}
              {order.carrier && <div><span className="text-muted-foreground">Transportadora</span><p className="font-medium">{order.carrier}</p></div>}
              {order.freightCost && <div><span className="text-muted-foreground">Frete</span><p className="font-medium">{fmtCurrency(order.freightCost)}</p></div>}
              {order.receivedAt && <div><span className="text-muted-foreground">Recebido em</span><p className="font-medium">{fmtDateTime(order.receivedAt)}</p></div>}
              {order.notes && <div className="col-span-2"><span className="text-muted-foreground">Observações</span><p>{order.notes}</p></div>}
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
                      <TableCell className="text-right text-sm tabular-nums">{parseFloat(item.quantity).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">{fmtCurrency(item.totalPrice)}</TableCell>
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
                <Button variant="outline" size="sm" onClick={() => onStatusChange(order.id, "sent")}>
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Marcar como Enviado
                </Button>
              )}
              {order.status === "sent" && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onReceive(order)}>
                  <PackageCheck className="h-3.5 w-3.5 mr-1.5" /> Confirmar Recebimento
                </Button>
              )}
              {(order.status === "draft" || order.status === "sent") && (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => onStatusChange(order.id, "cancelled")}>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar pedido
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Price History Sheet ───────────────────────────────────────────────────────

function PriceHistorySheet({
  open,
  onClose,
  supplierId,
  supplierName,
}: {
  open: boolean;
  onClose: () => void;
  supplierId: number | null;
  supplierName: string;
}) {
  const { data: history = [] } = useGetPriceHistory(
    { supplierId: supplierId ?? undefined },
    { query: { enabled: !!supplierId && open } as any }
  );

  // Group by product
  const grouped = useMemo(() => {
    const map = new Map<string, typeof history>();
    for (const h of history) {
      const key = h.productId ? `p${h.productId}` : (h.description ?? "item");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    return map;
  }, [history]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="min-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Histórico de Preços — {supplierName}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra recebida deste fornecedor.</p>
          ) : (
            Array.from(grouped.entries()).map(([key, points]) => {
              const first = points[0]!;
              return (
                <div key={key} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/20 px-3 py-2">
                    <p className="text-sm font-medium">{first.productName ?? first.description}</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PC #</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Preço unit.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {points.map((p) => (
                        <TableRow key={p.orderId}>
                          <TableCell className="text-sm font-mono text-muted-foreground">#{p.orderId}</TableCell>
                          <TableCell className="text-sm">{fmtDate(p.date)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{parseFloat(p.quantity).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums font-medium">{fmtCurrency(p.unitPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
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
  const [priceHistorySupplier, setPriceHistorySupplier] = useState<{ id: number; name: string } | null>(null);

  // PO state
  const [poStatusFilter, setPoStatusFilter] = useState("all");
  const [poSearch, setPoSearch] = useState("");
  const [poDialog, setPoDialog] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrderWithItems | null>(null);
  const [viewPoId, setViewPoId] = useState<number | null>(null);
  const [editLoadPoId, setEditLoadPoId] = useState<number | null>(null);
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrderWithItems | null>(null);
  const [deletePo, setDeletePo] = useState<PurchaseOrder | null>(null);

  // Purchase request state
  const [reqDialog, setReqDialog] = useState(false);
  const [editingReq, setEditingReq] = useState<PurchaseRequest | null>(null);
  const [reqStatusFilter, setReqStatusFilter] = useState("all");

  // Quotation state
  const [quotDialog, setQuotDialog] = useState(false);
  const [viewQuotation, setViewQuotation] = useState<QuotationWithItems | null>(null);

  // Queries
  const { data: suppliers = [], isLoading: supplLoading } = useListSuppliers({});
  const { data: orders = [], isLoading: ordersLoading } = useListPurchaseOrders({});
  const { data: dashboard } = useGetComprasDashboard();
  const { data: products = [] } = useListProducts({});
  const { data: requests = [], isLoading: reqLoading } = useListPurchaseRequests({});
  const { data: quotations = [], isLoading: quotLoading } = useListQuotations({});
  const { data: warehouses = [] } = useListWarehouses({});

  // Load full PO for edit
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

  // Mutations
  const deleteSupplierM = useDeleteSupplier();
  const approvalM = useUpdateSupplierApproval();
  const deletePoM = useDeletePurchaseOrder();
  const statusM = useUpdatePurchaseOrderStatus();
  const receiveM = useReceivePurchaseOrder();
  const updateReqM = useUpdatePurchaseRequest();
  const approveReqM = useApprovePurchaseRequest();
  const rejectReqM = useRejectPurchaseRequest();

  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active === "true"), [suppliers]);
  const activeProducts = useMemo(() => products.filter((p) => p.active === "true"), [products]);

  const filteredSuppliers = useMemo(() => {
    if (!suppSearch) return activeSuppliers;
    const q = suppSearch.toLowerCase();
    return activeSuppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.document ?? "").toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q)
    );
  }, [activeSuppliers, suppSearch]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (poStatusFilter !== "all") list = list.filter((o) => o.status === poStatusFilter);
    if (poSearch) {
      const q = poSearch.toLowerCase();
      list = list.filter((o) => String(o.id).includes(q) || (o.supplierName ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [orders, poStatusFilter, poSearch]);

  const filteredRequests = useMemo(() => {
    if (reqStatusFilter === "all") return requests;
    return requests.filter((r) => r.status === reqStatusFilter);
  }, [requests, reqStatusFilter]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetComprasDashboardQueryKey() });
  };

  const handleReceive = (data: Parameters<typeof receiveM.mutate>[0]["data"]) => {
    receiveM.mutate(
      { id: receiveOrder!.id, data },
      {
        onSuccess: () => {
          invalidateAll();
          setReceiveOrder(null);
          setViewPoId(null);
        },
      }
    );
  };

  const handleStatusChange = (id: number, status: string) => {
    statusM.mutate({ id, data: { status: status as any } }, { onSuccess: () => { invalidateAll(); setViewPoId(null); } });
  };

  const handleApproveRequest = (req: PurchaseRequest) => {
    approveReqM.mutate(
      { id: req.id },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListPurchaseRequestsQueryKey() }) }
    );
  };

  const handleRejectRequest = (req: PurchaseRequest) => {
    rejectReqM.mutate(
      { id: req.id, data: {} },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListPurchaseRequestsQueryKey() }) }
    );
  };

  const handleSupplierApproval = (id: number, approvalStatus: string) => {
    approvalM.mutate(
      { id, data: { approvalStatus: approvalStatus as any } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }) }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader title="Compras" subtitle="Solicitações, cotações, pedidos e recebimento com controle de lote" />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="requests">
              Solicitações
              {(dashboard?.pendingRequestsCount ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1">
                  {dashboard?.pendingRequestsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quotations">Cotações</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <Card className="col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Gasto este mês</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{fmtCurrency(dashboard?.totalSpentThisMonth ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pedidos recebidos</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-blue-400" onClick={() => { setPoStatusFilter("sent"); setActiveTab("orders"); }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-blue-600">{dashboard?.sentCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Entregas pendentes</p>
                </CardContent>
              </Card>

              <Card className={`${(dashboard?.overdueCount ?? 0) > 0 ? "border-red-300" : ""}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Atrasados</CardTitle>
                  <AlertTriangle className={`h-4 w-4 ${(dashboard?.overdueCount ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${(dashboard?.overdueCount ?? 0) > 0 ? "text-red-600" : ""}`}>{dashboard?.overdueCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">PC com entrega vencida</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-amber-400" onClick={() => { setReqStatusFilter("pending"); setActiveTab("requests"); }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Solicitações</CardTitle>
                  <ClipboardList className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-amber-600">{dashboard?.pendingRequestsCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Aguardando aprovação</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Lotes em CQ</CardTitle>
                  <Package className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-orange-600">{dashboard?.lotsInCqCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Aguardando liberação</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Recebidos</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-green-600">{dashboard?.receivedCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pedidos concluídos</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pending deliveries */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Entregas pendentes</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => { setEditingPo(null); setPoDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Novo PC
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {(dashboard?.pendingDeliveries ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">Nenhuma entrega pendente ✓</p>
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
                        {(dashboard?.pendingDeliveries ?? []).map((o) => {
                          const isOverdue = o.expectedDeliveryDate && new Date(o.expectedDeliveryDate) < new Date();
                          return (
                            <TableRow
                              key={o.id}
                              className="cursor-pointer hover:bg-muted/40"
                              onClick={() => setViewPoId(o.id)}
                            >
                              <TableCell className="text-muted-foreground font-mono text-sm">#{o.id}</TableCell>
                              <TableCell className="text-sm font-medium">{o.supplierName ?? "—"}</TableCell>
                              <TableCell className={`text-sm ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                {fmtDate(o.expectedDeliveryDate)}
                                {isOverdue && " ⚠"}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">{fmtCurrency(o.totalAmount)}</TableCell>
                            </TableRow>
                          );
                        })}
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

            {/* Monthly spend bar chart */}
            {(dashboard?.monthlySpend ?? []).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Gastos mensais (recebidos)</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-32">
                    {(() => {
                      const data = dashboard?.monthlySpend ?? [];
                      const maxVal = Math.max(...data.map((d) => d.total), 1);
                      return data.map((d) => {
                        const pct = Math.round((d.total / maxVal) * 100);
                        const parts = (d.month ?? "").split("-");
                        const mm = parseInt(parts[1] ?? "1") - 1;
                        const monthName = new Date(2024, mm).toLocaleString("pt-BR", { month: "short" });
                        return (
                          <div key={d.month} className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-xs text-muted-foreground">{fmtCurrency(d.total)}</span>
                            <div className="w-full rounded-t-sm bg-primary/70 transition-all" style={{ height: `${Math.max(pct, 4)}%` }} />
                            <span className="text-xs text-muted-foreground capitalize">{monthName}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── PURCHASE ORDERS ───────────────────────────────────────────── */}
          <TabsContent value="orders" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <Input className="w-48" placeholder="Buscar fornecedor, #…" value={poSearch} onChange={(e) => setPoSearch(e.target.value)} />
                <Select value={poStatusFilter} onValueChange={setPoStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
                      <TableHead>NF</TableHead>
                      <TableHead>Entrega prevista</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!ordersLoading && filteredOrders.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhum pedido encontrado</TableCell></TableRow>
                    )}
                    {filteredOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-sm text-muted-foreground font-mono">#{o.id}</TableCell>
                        <TableCell className="text-sm font-medium">{o.supplierName ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={o.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{(o as any).nfNumber ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(o.expectedDeliveryDate)}</TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">{fmtCurrency(o.totalAmount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(o.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhes" onClick={() => setViewPoId(o.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {o.status === "sent" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Confirmar recebimento"
                                onClick={async () => {
                                  const full = await getPurchaseOrder(o.id);
                                  setReceiveOrder(full);
                                }}>
                                <PackageCheck className="h-4 w-4" />
                              </Button>
                            )}
                            {o.status === "draft" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                                  onClick={() => { setEditingPo(null); setPoDialog(false); setEditLoadPoId(o.id); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Cancelar" onClick={() => setDeletePo(o)}>
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

          {/* ── PURCHASE REQUESTS ─────────────────────────────────────────── */}
          <TabsContent value="requests" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <Select value={reqStatusFilter} onValueChange={setReqStatusFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="rejected">Rejeitada</SelectItem>
                  <SelectItem value="converted">Convertida em PC</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => { setEditingReq(null); setReqDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nova solicitação
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Qtd.</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reqLoading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!reqLoading && filteredRequests.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhuma solicitação encontrada</TableCell></TableRow>
                    )}
                    {filteredRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm font-mono text-muted-foreground">#{r.id}</TableCell>
                        <TableCell className="text-sm font-medium max-w-[180px] truncate">{r.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{(r as any).productName ?? "—"}</TableCell>
                        <TableCell className="text-sm tabular-nums">{parseFloat(r.quantity).toLocaleString("pt-BR")} {r.unit}</TableCell>
                        <TableCell><Badge variant={priorityColor(r.priority) as any} className="text-xs">{priorityLabel(r.priority)}</Badge></TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{(r as any).requestedByName ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {r.status === "pending" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Aprovar"
                                  onClick={() => handleApproveRequest(r)}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Rejeitar"
                                  onClick={() => handleRejectRequest(r)}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                                  onClick={() => { setEditingReq(r); setReqDialog(true); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {r.status === "approved" && (
                              <Button variant="outline" size="sm" className="h-8 text-xs" title="Criar cotação"
                                onClick={() => { setQuotDialog(true); }}>
                                <Scale className="h-3 w-3 mr-1" /> Cotar
                              </Button>
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

          {/* ── QUOTATIONS ────────────────────────────────────────────────── */}
          <TabsContent value="quotations" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Comparativo multi-fornecedor. Selecione o vencedor para gerar um Pedido de Compra automaticamente.
              </p>
              <Button onClick={() => setQuotDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nova cotação
              </Button>
            </div>

            <div className="space-y-3">
              {quotLoading && <p className="text-sm text-muted-foreground text-center py-10">Carregando…</p>}
              {!quotLoading && quotations.length === 0 && (
                <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma cotação criada</CardContent></Card>
              )}
              {quotations.map((q) => {
                const sorted = [...(q.items ?? [])].sort((a, b) => parseFloat(a.unitPrice) - parseFloat(b.unitPrice));
                const winner = q.items.find((i) => i.selected === "true");
                return (
                  <Card key={q.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewQuotation(q)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">#{q.id}</span>
                            <h3 className="font-medium text-sm">{q.title}</h3>
                            <Badge variant={q.status === "open" ? "secondary" : "outline"} className="text-xs capitalize">
                              {q.status === "open" ? "Aberta" : q.status === "closed" ? "Fechada" : "Cancelada"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(q.createdAt)} — {q.items.length} proposta(s)</p>
                          {winner && (
                            <p className="text-xs text-green-700 mt-0.5">
                              Vencedor: {winner.supplierName ?? "—"} — {fmtCurrency(winner.unitPrice)}/un
                            </p>
                          )}
                          {!winner && sorted.length > 0 && q.status === "open" && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              Menor preço: {sorted[0]!.supplierName ?? "—"} — {fmtCurrency(sorted[0]!.unitPrice)}/un
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {q.items.slice(0, 3).map((item) => (
                            <Badge key={item.id} variant="outline" className="text-xs">
                              {item.supplierName?.split(" ")[0] ?? "?"}: {fmtCurrency(item.unitPrice)}
                            </Badge>
                          ))}
                          <ChevronRight className="h-4 w-4 text-muted-foreground self-center" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── SUPPLIERS ─────────────────────────────────────────────────── */}
          <TabsContent value="suppliers" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <Input className="w-60" placeholder="Buscar nome, CNPJ, categoria…" value={suppSearch} onChange={(e) => setSupplSearch(e.target.value)} />
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
                      <TableHead>Status homologação</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplLoading && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!supplLoading && filteredSuppliers.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum fornecedor cadastrado</TableCell></TableRow>
                    )}
                    {filteredSuppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{s.name}</div>
                          {s.city && <div className="text-xs text-muted-foreground">{s.city}{s.state ? ` / ${s.state}` : ""}</div>}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">{s.document ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.category ?? "—"}</TableCell>
                        <TableCell>{approvalBadge(s.approvalStatus)}</TableCell>
                        <TableCell>
                          {s.email && <div className="text-sm text-muted-foreground">{s.email}</div>}
                          {s.phone && <div className="text-sm text-muted-foreground">{s.phone}</div>}
                          {!s.email && !s.phone && "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Histórico de preços"
                              onClick={() => setPriceHistorySupplier({ id: s.id, name: s.name })}>
                              <History className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                              onClick={() => { setEditingSupplier(s); setSupplierDialog(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {s.approvalStatus !== "blocked" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Bloquear fornecedor"
                                onClick={() => handleSupplierApproval(s.id, "blocked")}>
                                <ShieldX className="h-4 w-4" />
                              </Button>
                            )}
                            {s.approvalStatus === "blocked" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Reativar fornecedor"
                                onClick={() => handleSupplierApproval(s.id, "approved")}>
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Desativar"
                              onClick={() => setDeleteSupplier(s)}>
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

      {/* ── Dialogs ────────────────────────────────────────────────────── */}

      <SupplierDialog open={supplierDialog} onClose={() => { setSupplierDialog(false); setEditingSupplier(null); }} editing={editingSupplier} />

      <PurchaseRequestDialog
        open={reqDialog}
        onClose={() => { setReqDialog(false); setEditingReq(null); }}
        editing={editingReq}
        products={activeProducts}
      />

      <QuotationDialog
        open={quotDialog}
        onClose={() => setQuotDialog(false)}
        suppliers={activeSuppliers}
        products={activeProducts}
        requests={requests}
      />

      <QuotationDetailSheet
        quotation={viewQuotation}
        onClose={() => setViewQuotation(null)}
        onWinnerSelected={() => setActiveTab("orders")}
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
        onReceive={(order) => { setReceiveOrder(order); setViewPoId(null); }}
        onStatusChange={handleStatusChange}
      />

      <ReceiveDialog
        order={receiveOrder}
        warehouses={warehouses as any}
        onClose={() => setReceiveOrder(null)}
        onReceive={handleReceive}
      />

      <PriceHistorySheet
        open={!!priceHistorySupplier}
        onClose={() => setPriceHistorySupplier(null)}
        supplierId={priceHistorySupplier?.id ?? null}
        supplierName={priceHistorySupplier?.name ?? ""}
      />

      {/* Cancel PO */}
      <AlertDialog open={!!deletePo} onOpenChange={(v) => !v && setDeletePo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>O PC #{deletePo?.id} será cancelado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deletePoM.mutate({ id: deletePo!.id }, { onSuccess: () => { invalidateAll(); setDeletePo(null); } })}
            >
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete supplier */}
      <AlertDialog open={!!deleteSupplier} onOpenChange={(v) => !v && setDeleteSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteSupplier?.name}" será desativado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteSupplierM.mutate({ id: deleteSupplier!.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); setDeleteSupplier(null); } })}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
