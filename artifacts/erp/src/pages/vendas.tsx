import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useListSalesOrders,
  useCreateSalesOrder,
  useUpdateSalesOrder,
  useDeleteSalesOrder,
  useConvertQuoteToOrder,
  useUpdateSalesOrderStatus,
  useGetVendasDashboard,
  useGetSalesOrder,
  getListClientsQueryKey,
  getListSalesOrdersQueryKey,
  getGetVendasDashboardQueryKey,
} from "@workspace/api-client-react";
import type { Client, SalesOrder } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus, Pencil, Trash2, TrendingUp, ShoppingCart, FileText,
  Users, ArrowRightCircle, CheckCircle, Truck, XCircle, RefreshCw,
} from "lucide-react";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmt(v: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

const ORDER_STATUS: Record<string, { label: string; variant: "default"|"secondary"|"destructive"|"outline"; icon: React.ElementType }> = {
  draft:      { label: "Rascunho",  variant: "secondary",    icon: FileText },
  confirmed:  { label: "Confirmado",variant: "default",      icon: CheckCircle },
  delivered:  { label: "Entregue",  variant: "outline",      icon: Truck },
  cancelled:  { label: "Cancelado", variant: "destructive",  icon: XCircle },
};

// ─── Client Dialog ─────────────────────────────────────────────────────────────

function validateDocument(doc: string | undefined): boolean {
  if (!doc) return true;
  const digits = doc.replace(/\D/g, "");
  return digits.length === 0 || digits.length === 11 || digits.length === 14;
}

const clientSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  document: z
    .string()
    .optional()
    .refine(validateDocument, "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z
    .string()
    .optional()
    .refine((v) => !v || v.length <= 2, "Use a sigla do estado (ex: SP)"),
  notes: z.string().optional(),
});
type ClientForm = z.infer<typeof clientSchema>;

function ClientDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Client | null }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    values: editing
      ? { name: editing.name, document: editing.document ?? "", email: editing.email ?? "", phone: editing.phone ?? "", address: editing.address ?? "", city: editing.city ?? "", state: editing.state ?? "", notes: editing.notes ?? "" }
      : { name: "", document: "", email: "", phone: "", address: "", city: "", state: "", notes: "" },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = { ...data, document: data.document || null, email: data.email || null, phone: data.phone || null, address: data.address || null, city: data.city || null, state: data.state || null, notes: data.notes || null };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, { onSuccess: () => { invalidate(); onClose(); } });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess: () => { invalidate(); onClose(); form.reset(); } });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome *</label>
            <Input {...form.register("name")} placeholder="Razão social ou nome" />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">CNPJ/CPF</label>
              <Input {...form.register("document")} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Telefone</label>
              <Input {...form.register("phone")} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">E-mail</label>
            <Input {...form.register("email")} type="email" placeholder="contato@empresa.com" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Endereço</label>
            <Input {...form.register("address")} placeholder="Rua, número, bairro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Cidade</label>
              <Input {...form.register("city")} placeholder="São Paulo" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Estado</label>
              <Input {...form.register("state")} placeholder="SP" maxLength={2} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Observações</label>
            <Input {...form.register("notes")} placeholder="Opcional" />
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

// ─── Order Dialog ──────────────────────────────────────────────────────────────

const itemSchema = z.object({
  description: z.string().min(1, "Obrigatório"),
  quantity: z.string().min(1).refine((v) => Number(v) > 0, "Deve ser > 0"),
  unitPrice: z.string().min(1).refine((v) => Number(v) >= 0, "Inválido"),
  productId: z.number().optional(),
});

const orderSchema = z.object({
  type: z.enum(["quote", "order"]),
  clientId: z.string().optional(),
  status: z.enum(["draft", "confirmed", "delivered", "cancelled"]),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Adicione pelo menos um item"),
});
type OrderForm = z.infer<typeof orderSchema>;

function OrderDialog({ open, onClose, editing, clients }: { open: boolean; onClose: () => void; editing?: SalesOrder | null; clients: Client[] }) {
  const qc = useQueryClient();
  const invalidateOrders = () => {
    qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetVendasDashboardQueryKey() });
  };

  const createMutation = useCreateSalesOrder();
  const updateMutation = useUpdateSalesOrder();

  // Load full order (with items) when editing — id=0 disables the query automatically
  const { data: fullOrder, isLoading: loadingOrder } = useGetSalesOrder(editing?.id ?? 0);

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { type: "quote", clientId: "", status: "draft", validUntil: "", notes: "", items: [{ description: "", quantity: "1", unitPrice: "0" }] },
  });

  // Populate form once full order data is available (edit flow)
  const [populated, setPopulated] = useState(false);
  useEffect(() => {
    if (!open) { setPopulated(false); return; }
    if (!editing) {
      form.reset({ type: "quote", clientId: "", status: "draft", validUntil: "", notes: "", items: [{ description: "", quantity: "1", unitPrice: "0" }] });
      setPopulated(true);
      return;
    }
    if (!fullOrder || populated) return;
    form.reset({
      type: fullOrder.type as "quote" | "order",
      clientId: fullOrder.clientId ? String(fullOrder.clientId) : "",
      status: fullOrder.status as "draft" | "confirmed" | "delivered" | "cancelled",
      validUntil: fullOrder.validUntil ? new Date(fullOrder.validUntil).toISOString().slice(0, 10) : "",
      notes: fullOrder.notes ?? "",
      items: fullOrder.items.length > 0
        ? fullOrder.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice }))
        : [{ description: "", quantity: "1", unitPrice: "0" }],
    });
    setPopulated(true);
  }, [open, editing, fullOrder, populated, form]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const watchedItems = form.watch("items");
  const total = watchedItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      type: data.type,
      clientId: data.clientId ? parseInt(data.clientId) : null,
      status: data.status,
      validUntil: data.validUntil ? new Date(data.validUntil + "T00:00:00").toISOString() : null,
      notes: data.notes || null,
      items: data.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload as any }, { onSuccess: () => { invalidateOrders(); onClose(); } });
    } else {
      createMutation.mutate({ data: payload as any }, { onSuccess: () => { invalidateOrders(); onClose(); form.reset(); } });
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending || loadingOrder;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} {form.watch("type") === "quote" ? "Orçamento" : "Pedido"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo</label>
              <Controller control={form.control} name="type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quote">Orçamento</SelectItem>
                    <SelectItem value="order">Pedido de Venda</SelectItem>
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
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Cliente</label>
              <Controller control={form.control} name="clientId" render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem cliente —</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Validade (orçamento)</label>
              <Input type="date" {...form.register("validUntil")} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Observações</label>
            <Input {...form.register("notes")} placeholder="Opcional" />
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Itens</label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: "1", unitPrice: "0" })}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar item
              </Button>
            </div>
            {form.formState.errors.items?.root && <p className="text-xs text-destructive">{form.formState.errors.items.root.message}</p>}
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-[1fr_80px_100px_36px] gap-2 items-start">
                  <div>
                    <Input {...form.register(`items.${idx}.description`)} placeholder="Descrição do item" />
                    {form.formState.errors.items?.[idx]?.description && (
                      <p className="text-xs text-destructive">{form.formState.errors.items[idx]?.description?.message}</p>
                    )}
                  </div>
                  <Input {...form.register(`items.${idx}.quantity`)} placeholder="Qtd" type="number" step="0.001" min="0" />
                  <Input {...form.register(`items.${idx}.unitPrice`)} placeholder="Preço unit." type="number" step="0.01" min="0" />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => remove(idx)} disabled={fields.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <span className="text-sm font-semibold">Total: {fmt(total)}</span>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function VendasPage() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();

  // Client state
  const [clientSearch, setClientSearch] = useState("");
  const [clientDialog, setClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  // Order state
  const [orderType, setOrderType] = useState<string>("all");
  const [orderStatus, setOrderStatus] = useState<string>("all");
  const [orderDialog, setOrderDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<SalesOrder | null>(null);

  const invalidateOrders = () => {
    qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetVendasDashboardQueryKey() });
  };

  const { data: clients = [] } = useListClients({});
  const activeClients = useMemo(() => clients.filter((c) => c.active === "true"), [clients]);

  const orderParams = useMemo(() => ({
    ...(orderType !== "all" ? { type: orderType as "quote"|"order" } : {}),
    ...(orderStatus !== "all" ? { status: orderStatus as any } : {}),
  }), [orderType, orderStatus]);

  const { data: orders = [], isLoading: ordersLoading } = useListSalesOrders(orderParams);
  const { data: dashboard } = useGetVendasDashboard({ year: currentYear });

  const deleteCMutation = useDeleteClient();
  const deleteOMutation = useDeleteSalesOrder();
  const convertMutation = useConvertQuoteToOrder();
  const statusMutation = useUpdateSalesOrderStatus();

  const filteredClients = useMemo(() => {
    if (!clientSearch) return activeClients;
    const q = clientSearch.toLowerCase();
    return activeClients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.document ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  }, [activeClients, clientSearch]);

  const chartData = (dashboard?.monthlyChart ?? []).map((m) => ({
    name: MONTHS[m.month - 1],
    Vendas: m.total,
  }));

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Vendas / Comercial"
          subtitle="Clientes, orçamentos e pedidos"
        />

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="orders">Orçamentos & Pedidos</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vendas este mês</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{fmt(dashboard?.totalThisMonth ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{dashboard?.ordersThisMonth ?? 0} pedidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Orçamentos abertos</CardTitle>
                  <FileText className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{dashboard?.totalQuotes ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total de orçamentos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Conversão</CardTitle>
                  <ArrowRightCircle className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{dashboard?.conversionRate ?? 0}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Orçamentos → pedidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Clientes ativos</CardTitle>
                  <Users className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{activeClients.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cadastrados no sistema</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Vendas Mensais — {currentYear}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} />
                      <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Top Clientes</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(dashboard?.topClients ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
                  )}
                  {(dashboard?.topClients ?? []).map((c, i) => (
                    <div key={c.clientId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-5">#{i+1}</span>
                        <span className="text-sm font-medium truncate max-w-[130px]">{c.clientName}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{fmt(c.total)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── ORDERS TAB ────────────────────────────────────────────────── */}
          <TabsContent value="orders" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="quote">Orçamento</SelectItem>
                    <SelectItem value="order">Pedido</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={orderStatus} onValueChange={setOrderStatus}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { setEditingOrder(null); setOrderDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!ordersLoading && orders.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Nenhum registro encontrado</TableCell></TableRow>
                    )}
                    {orders.map((order) => {
                      const st = ORDER_STATUS[order.status] ?? ORDER_STATUS.draft;
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{order.id}</TableCell>
                          <TableCell>
                            <Badge variant={order.type === "quote" ? "outline" : "secondary"} className="text-xs">
                              {order.type === "quote" ? "Orçamento" : "Pedido"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{order.clientName ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDate(order.createdAt)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{fmt(order.totalAmount)}</TableCell>
                          <TableCell>
                            <Badge variant={st.variant} className="text-xs gap-1">
                              <st.icon className="h-3 w-3" />
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {order.type === "quote" && order.status !== "cancelled" && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Converter em pedido"
                                  onClick={() => convertMutation.mutate({ id: order.id }, { onSuccess: () => invalidateOrders() })}
                                  disabled={convertMutation.isPending}>
                                  <ArrowRightCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {order.type === "order" && order.status === "confirmed" && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Marcar como entregue"
                                  onClick={() => statusMutation.mutate({ id: order.id, data: { status: "delivered" } }, { onSuccess: () => invalidateOrders() })}
                                  disabled={statusMutation.isPending}>
                                  <Truck className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingOrder(order); setOrderDialog(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteOrder(order)}>
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

          {/* ── CLIENTS TAB ───────────────────────────────────────────────── */}
          <TabsContent value="clients" className="space-y-4 mt-4">
            <div className="flex gap-3 items-center justify-between">
              <Input
                className="max-w-xs"
                placeholder="Buscar por nome, CNPJ ou e-mail…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              <Button onClick={() => { setEditingClient(null); setClientDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo Cliente
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ/CPF</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum cliente encontrado</TableCell></TableRow>
                    )}
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">{client.document ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{client.email ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{client.phone ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[client.city, client.state].filter(Boolean).join("/") || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingClient(client); setClientDialog(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteClient(client)}>
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

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <ClientDialog open={clientDialog} onClose={() => { setClientDialog(false); setEditingClient(null); }} editing={editingClient} />

      <OrderDialog open={orderDialog} onClose={() => { setOrderDialog(false); setEditingOrder(null); }} editing={editingOrder} clients={activeClients} />

      <AlertDialog open={!!deleteClient} onOpenChange={(v) => !v && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteClient?.name}" será marcado como inativo. Seus pedidos serão preservados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCMutation.mutate({ id: deleteClient!.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListClientsQueryKey() }); setDeleteClient(null); } })}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteOrder} onOpenChange={(v) => !v && setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteOrder?.type === "quote" ? "orçamento" : "pedido"}?</AlertDialogTitle>
            <AlertDialogDescription>O {deleteOrder?.type === "quote" ? "orçamento" : "pedido"} #{deleteOrder?.id} será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOMutation.mutate({ id: deleteOrder!.id }, { onSuccess: () => { invalidateOrders(); setDeleteOrder(null); } })}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
