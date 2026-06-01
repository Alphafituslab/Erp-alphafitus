import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useListStockMovements,
  useCreateStockMovement,
  useGetEstoqueDashboard,
  getListProductsQueryKey,
  getListStockMovementsQueryKey,
  getGetEstoqueDashboardQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
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
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus, Pencil, Trash2, Package, AlertTriangle,
  TrendingDown, TrendingUp, ArrowDown, ArrowUp, Boxes,
} from "lucide-react";

function fmt(v: string | number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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
  costPrice: z.string().optional().refine(
    (v) => !v || !isNaN(Number(v)),
    "Valor inválido"
  ),
  salePrice: z.string().optional().refine(
    (v) => !v || !isNaN(Number(v)),
    "Valor inválido"
  ),
  minStock: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= 0),
    "Deve ser ≥ 0"
  ),
  currentStock: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= 0),
    "Deve ser ≥ 0"
  ),
});
type ProductForm = z.infer<typeof productSchema>;

function ProductDialog({
  open, onClose, editing,
}: {
  open: boolean; onClose: () => void; editing?: Product | null;
}) {
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
      ? {
          name: editing.name,
          sku: editing.sku ?? "",
          description: editing.description ?? "",
          category: editing.category ?? "",
          unit: editing.unit ?? "un",
          costPrice: editing.costPrice ?? "",
          salePrice: editing.salePrice ?? "",
          minStock: String(editing.minStock),
          currentStock: String(editing.currentStock),
        }
      : { name: "", sku: "", description: "", category: "", unit: "un", costPrice: "", salePrice: "", minStock: "0", currentStock: "0" },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      name: data.name,
      sku: data.sku || null,
      description: data.description || null,
      category: data.category || null,
      unit: data.unit || "un",
      costPrice: data.costPrice || null,
      salePrice: data.salePrice || null,
      minStock: data.minStock ? parseInt(data.minStock) : 0,
      currentStock: data.currentStock ? parseInt(data.currentStock) : 0,
    };
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: payload },
        { onSuccess: () => { invalidate(); onClose(); } }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        { onSuccess: () => { invalidate(); onClose(); form.reset(); } }
      );
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input {...form.register("name")} placeholder="Nome do produto" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">SKU</label>
              <Input {...form.register("sku")} placeholder="ABC-001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoria</label>
              <Input {...form.register("category")} placeholder="Ex: Eletrônicos" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Unidade</label>
              <Input {...form.register("unit")} placeholder="un, kg, cx, L…" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <Input {...form.register("description")} placeholder="Opcional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Preço de custo</label>
              <Input {...form.register("costPrice")} type="number" step="0.01" min="0" placeholder="0,00" />
              {form.formState.errors.costPrice && (
                <p className="text-xs text-destructive">{form.formState.errors.costPrice.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Preço de venda</label>
              <Input {...form.register("salePrice")} type="number" step="0.01" min="0" placeholder="0,00" />
              {form.formState.errors.salePrice && (
                <p className="text-xs text-destructive">{form.formState.errors.salePrice.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Estoque mínimo</label>
              <Input {...form.register("minStock")} type="number" min="0" step="1" />
              {form.formState.errors.minStock && (
                <p className="text-xs text-destructive">{form.formState.errors.minStock.message}</p>
              )}
            </div>
            {!editing && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Estoque inicial</label>
                <Input {...form.register("currentStock")} type="number" min="0" step="1" />
                {form.formState.errors.currentStock && (
                  <p className="text-xs text-destructive">{form.formState.errors.currentStock.message}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
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
  type: z.enum(["input", "output"]),
  quantity: z.string().refine((v) => parseInt(v) > 0, "Deve ser ≥ 1"),
  reason: z.string().optional(),
  notes: z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

function MovementDialog({
  open, onClose, products, defaultProductId,
}: {
  open: boolean; onClose: () => void; products: Product[]; defaultProductId?: number;
}) {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getListStockMovementsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEstoqueDashboardQueryKey() });
  };
  const createMutation = useCreateStockMovement();

  const form = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      productId: defaultProductId ? String(defaultProductId) : "",
      type: "input",
      quantity: "1",
      reason: "",
      notes: "",
    },
  });

  // Reset when dialog reopens
  const wasOpen = open;
  if (wasOpen && !form.getValues("productId") && defaultProductId) {
    form.setValue("productId", String(defaultProductId));
  }

  const selectedProductId = parseInt(form.watch("productId") || "0");
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const onSubmit = form.handleSubmit((data) => {
    createMutation.mutate(
      {
        data: {
          productId: parseInt(data.productId),
          type: data.type,
          quantity: parseInt(data.quantity),
          reason: data.reason || null,
          notes: data.notes || null,
        },
      },
      {
        onSuccess: () => {
          invalidateAll();
          onClose();
          form.reset({ productId: "", type: "input", quantity: "1", reason: "", notes: "" });
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? "Erro ao registrar movimentação";
          form.setError("quantity", { message: msg });
        },
      }
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Movimentação</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Produto *</label>
            <Controller
              control={form.control}
              name="productId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar produto…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} {p.sku ? `(${p.sku})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.productId && (
              <p className="text-xs text-destructive">{form.formState.errors.productId.message}</p>
            )}
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
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="input">
                        <span className="flex items-center gap-1.5">
                          <ArrowDown className="h-3.5 w-3.5 text-green-600" /> Entrada
                        </span>
                      </SelectItem>
                      <SelectItem value="output">
                        <span className="flex items-center gap-1.5">
                          <ArrowUp className="h-3.5 w-3.5 text-red-500" /> Saída
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Quantidade *</label>
              <Input {...form.register("quantity")} type="number" min="1" step="1" />
              {form.formState.errors.quantity && (
                <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Motivo</label>
            <Input {...form.register("reason")} placeholder="Ex: Compra, Venda, Ajuste manual…" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Observações</label>
            <Input {...form.register("notes")} placeholder="Opcional" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EstoquePage() {
  const qc = useQueryClient();

  // Tab state — controlled so dashboard can navigate to products
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
  const [movSearch, setMovSearch]= useState("");

  const { data: products = [], isLoading: productsLoading } = useListProducts({});
  const { data: movements = [], isLoading: movementsLoading } = useListStockMovements({});
  const { data: dashboard } = useGetEstoqueDashboard();

  const deleteMutation = useDeleteProduct();

  // Derived data
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
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeProducts, categoryFilter, stockAlertFilter, search]);

  const filteredMovements = useMemo(() => {
    let list = movements;
    if (movTypeFilter !== "all") list = list.filter((m) => m.type === movTypeFilter);
    if (movSearch) {
      const q = movSearch.toLowerCase();
      list = list.filter(
        (m) =>
          (m.productName ?? "").toLowerCase().includes(q) ||
          (m.reason ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [movements, movTypeFilter, movSearch]);

  function openMovementFor(productId?: number) {
    setMovementProductId(productId);
    setMovementDialog(true);
  }

  function goToProductsWithAlertFilter() {
    setStockAlertFilter(true);
    setCategoryFilter("all");
    setSearch("");
    setActiveTab("products");
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Estoque"
          subtitle="Produtos, níveis de estoque e movimentações"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="movements">Movimentações</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

              <Card
                className={((dashboard?.lowStockCount ?? 0) > 0) ? "cursor-pointer hover:border-yellow-400 transition-colors" : ""}
                onClick={() => (dashboard?.lowStockCount ?? 0) > 0 && goToProductsWithAlertFilter()}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Estoque baixo</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-yellow-600">{dashboard?.lowStockCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(dashboard?.lowStockCount ?? 0) > 0 ? "Clique para ver" : "Abaixo do mínimo"}
                  </p>
                </CardContent>
              </Card>

              <Card
                className={((dashboard?.outOfStockCount ?? 0) > 0) ? "cursor-pointer hover:border-red-400 transition-colors" : ""}
                onClick={() => (dashboard?.outOfStockCount ?? 0) > 0 && goToProductsWithAlertFilter()}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sem estoque</CardTitle>
                  <TrendingDown className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-destructive">{dashboard?.outOfStockCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(dashboard?.outOfStockCount ?? 0) > 0 ? "Clique para ver" : "Produtos zerados"}
                  </p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Low stock products */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Produtos com alerta de estoque</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => openMovementFor()}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Entrada
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {(dashboard?.lowStockProducts ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">Nenhum produto em alerta ✓</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Estoque</TableHead>
                          <TableHead className="text-right">Mínimo</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dashboard?.lowStockProducts ?? []).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{p.name}</div>
                              {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                            </TableCell>
                            <TableCell className="text-right">
                              <StockBadge product={p} />
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{p.minStock}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => openMovementFor(p.id)}
                              >
                                + Entrada
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Recent movements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Últimas movimentações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(dashboard?.recentMovements ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada</p>
                  )}
                  {(dashboard?.recentMovements ?? []).map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {m.type === "input" ? (
                          <ArrowDown className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <ArrowUp className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{m.productName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{m.reason ?? m.referenceType ?? "—"}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${m.type === "input" ? "text-green-600" : "text-red-500"}`}>
                          {m.type === "input" ? "+" : "-"}{m.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDate(m.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── PRODUCTS TAB ───────────────────────────────────────────────── */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3 flex-wrap items-center">
                <Input
                  className="w-56"
                  placeholder="Buscar por nome, SKU…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stockAlertFilter && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 cursor-pointer border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400 hover:bg-yellow-100"
                    onClick={() => setStockAlertFilter(false)}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Somente alertas
                    <span className="ml-0.5 text-yellow-500">×</span>
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openMovementFor()}>
                  <Package className="h-4 w-4 mr-2" /> Movimentação
                </Button>
                <Button onClick={() => { setEditingProduct(null); setProductDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Novo produto
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unid.</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Venda</TableHead>
                      <TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsLoading && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!productsLoading && filteredProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                          Nenhum produto encontrado
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                              {product.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {product.sku ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.category ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{product.unit}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {product.costPrice ? fmt(product.costPrice) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {product.salePrice ? fmt(product.salePrice) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <StockBadge product={product} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700"
                              title="Registrar movimentação"
                              onClick={() => openMovementFor(product.id)}
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setEditingProduct(product); setProductDialog(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteProduct(product)}
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

          {/* ── MOVEMENTS TAB ─────────────────────────────────────────────── */}
          <TabsContent value="movements" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <Input
                  className="w-56"
                  placeholder="Buscar por produto, motivo…"
                  value={movSearch}
                  onChange={(e) => setMovSearch(e.target.value)}
                />
                <Select value={movTypeFilter} onValueChange={setMovTypeFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="input">Entrada</SelectItem>
                    <SelectItem value="output">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => openMovementFor()}>
                <Plus className="h-4 w-4 mr-2" /> Nova movimentação
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Referência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!movementsLoading && filteredMovements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          Nenhuma movimentação encontrada
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {fmtDateTime(m.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium">{m.productName ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={m.type} />
                        </TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${m.type === "input" ? "text-green-600" : "text-red-500"}`}>
                          {m.type === "input" ? "+" : "-"}{m.quantity}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.reason ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.referenceType ?? "—"}
                          {m.referenceId ? ` #${m.referenceId}` : ""}
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

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <ProductDialog
        open={productDialog}
        onClose={() => { setProductDialog(false); setEditingProduct(null); }}
        editing={editingProduct}
      />

      <MovementDialog
        open={movementDialog}
        onClose={() => { setMovementDialog(false); setMovementProductId(undefined); }}
        products={activeProducts}
        defaultProductId={movementProductId}
      />

      <AlertDialog open={!!deleteProduct} onOpenChange={(v) => !v && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteProduct?.name}" será marcado como inativo. O histórico de movimentações será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteMutation.mutate(
                  { id: deleteProduct!.id },
                  {
                    onSuccess: () => {
                      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
                      qc.invalidateQueries({ queryKey: getGetEstoqueDashboardQueryKey() });
                      setDeleteProduct(null);
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
