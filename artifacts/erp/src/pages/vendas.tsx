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
  useListSalesOrderLogs,
  useGetClientTopDebtors,
  getListClientsQueryKey,
  getListSalesOrdersQueryKey,
  getGetVendasDashboardQueryKey,
} from "@workspace/api-client-react";
import type { Client, SalesOrder, SalesOrderLog, ClientCreditSummary } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
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
  Users, ArrowRightCircle, Truck, Clock, AlertTriangle,
  CheckCircle2, XCircle, ChevronRight, Layers, History,
} from "lucide-react";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmt(v: string | number) {
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

// ─── Status Config ────────────────────────────────────────────────────────────

type OrderStatus =
  | "draft" | "awaiting_docs" | "sent"
  | "client_approved" | "client_rejected"
  | "credit_check" | "credit_rejected"
  | "financial_review" | "financial_rejected"
  | "technical_review" | "technical_rejected"
  | "regulatory_check" | "pcp_released" | "raw_material_check"
  | "production_planned" | "in_production"
  | "quality_check" | "quality_rejected" | "quality_approved"
  | "billing" | "invoice_issued" | "awaiting_pickup"
  | "shipped" | "delivered" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  draft:              "Rascunho",
  awaiting_docs:      "Aguardando Docs",
  sent:               "Enviado",
  client_approved:    "Aprovado Cliente",
  client_rejected:    "Reprovado Cliente",
  credit_check:       "Análise de Crédito",
  credit_rejected:    "Crédito Reprovado",
  financial_review:   "Análise Financeira",
  financial_rejected: "Reprovado Financeiro",
  technical_review:   "Análise Técnica",
  technical_rejected: "Reprovado Técnico",
  regulatory_check:   "Análise Regulatória",
  pcp_released:       "Liberado PCP",
  raw_material_check: "Verificação MP",
  production_planned: "Prod. Planejada",
  in_production:      "Em Produção",
  quality_check:      "Controle de Qualidade",
  quality_rejected:   "CQ Reprovado",
  quality_approved:   "CQ Aprovado",
  billing:            "Faturamento",
  invoice_issued:     "NF Emitida",
  awaiting_pickup:    "Aguardando Coleta",
  shipped:            "Expedido",
  delivered:          "Entregue",
  cancelled:          "Cancelado",
};

const PIPELINE_STAGES: OrderStatus[] = [
  "draft", "awaiting_docs", "sent",
  "client_approved", "credit_check",
  "financial_review", "technical_review", "regulatory_check",
  "pcp_released", "raw_material_check", "production_planned",
  "in_production", "quality_check", "quality_approved",
  "billing", "invoice_issued", "awaiting_pickup", "shipped",
];

const TERMINAL_STATUSES = [
  "delivered", "cancelled",
  "client_rejected", "credit_rejected",
  "financial_rejected", "technical_rejected", "quality_rejected",
];

type Transition = { to: OrderStatus; label: string; variant?: "default" | "destructive" | "outline"; requiresNote?: boolean };

const TRANSITIONS: Record<string, Transition[]> = {
  draft: [
    { to: "awaiting_docs", label: "Aguardar Documentos", variant: "outline" },
    { to: "sent", label: "Enviar ao Cliente", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  awaiting_docs: [
    { to: "sent", label: "Enviar ao Cliente", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  sent: [
    { to: "client_approved", label: "Aprovado pelo Cliente", variant: "default" },
    { to: "client_rejected", label: "Reprovado pelo Cliente", variant: "destructive", requiresNote: true },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  client_approved: [
    { to: "credit_check", label: "Iniciar Análise de Crédito", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  client_rejected: [
    { to: "sent", label: "Reenviar ao Cliente", variant: "outline" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  credit_check: [
    { to: "financial_review", label: "Crédito OK → Análise Financeira", variant: "default" },
    { to: "credit_rejected", label: "Crédito Reprovado", variant: "destructive", requiresNote: true },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  credit_rejected: [
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  financial_review: [
    { to: "technical_review", label: "Financeiro OK → Análise Técnica", variant: "default" },
    { to: "financial_rejected", label: "Reprovar Financeiro", variant: "destructive", requiresNote: true },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  financial_rejected: [
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  technical_review: [
    { to: "regulatory_check", label: "Técnico OK → Análise Regulatória", variant: "default" },
    { to: "technical_rejected", label: "Reprovar Técnico", variant: "destructive", requiresNote: true },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  technical_rejected: [
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  regulatory_check: [
    { to: "pcp_released", label: "Liberar para PCP", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  pcp_released: [
    { to: "raw_material_check", label: "Verificar Matéria-Prima", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  raw_material_check: [
    { to: "production_planned", label: "MP OK → Planejar Produção", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  production_planned: [
    { to: "in_production", label: "Iniciar Produção", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  in_production: [
    { to: "quality_check", label: "Enviar para CQ", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  quality_check: [
    { to: "quality_approved", label: "CQ Aprovado", variant: "default" },
    { to: "quality_rejected", label: "CQ Reprovado → Retrabalho", variant: "destructive", requiresNote: true },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  quality_rejected: [
    { to: "in_production", label: "Retornar para Produção", variant: "outline" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  quality_approved: [
    { to: "billing", label: "Liberar Faturamento", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  billing: [
    { to: "invoice_issued", label: "NF Emitida", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  invoice_issued: [
    { to: "awaiting_pickup", label: "Aguardar Coleta", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  awaiting_pickup: [
    { to: "shipped", label: "Marcar como Expedido", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive", requiresNote: true },
  ],
  shipped: [
    { to: "delivered", label: "Confirmar Entrega", variant: "default" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateDocument(doc: string | undefined): boolean {
  if (!doc) return true;
  const digits = doc.replace(/\D/g, "");
  return digits.length === 0 || digits.length === 11 || digits.length === 14;
}

// ─── Client Dialog ─────────────────────────────────────────────────────────────

const clientSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  tradeName: z.string().optional(),
  document: z.string().optional().refine(validateDocument, "CPF (11) ou CNPJ (14) dígitos"),
  stateRegistration: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  // Billing address
  billingZipCode: z.string().optional(),
  billingStreet: z.string().optional(),
  billingNumber: z.string().optional(),
  billingComplement: z.string().optional(),
  billingNeighborhood: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional().refine((v) => !v || v.length <= 2, "Sigla UF"),
  // Shipping address
  shippingZipCode: z.string().optional(),
  shippingStreet: z.string().optional(),
  shippingNumber: z.string().optional(),
  shippingComplement: z.string().optional(),
  shippingNeighborhood: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional().refine((v) => !v || v.length <= 2, "Sigla UF"),
  // Contact
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  // Commercial
  creditLimit: z.string().optional().refine((v) => !v || !isNaN(Number(v)), "Valor inválido"),
  defaultDiscountPct: z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100), "0–100%"),
  taxRegime: z.string().optional(),
  notes: z.string().optional(),
});
type ClientForm = z.infer<typeof clientSchema>;

const CLIENT_EMPTY: ClientForm = {
  name: "", tradeName: "", document: "", stateRegistration: "", email: "", phone: "",
  billingZipCode: "", billingStreet: "", billingNumber: "", billingComplement: "",
  billingNeighborhood: "", billingCity: "", billingState: "",
  shippingZipCode: "", shippingStreet: "", shippingNumber: "", shippingComplement: "",
  shippingNeighborhood: "", shippingCity: "", shippingState: "",
  contactName: "", contactPhone: "",
  creditLimit: "", defaultDiscountPct: "", taxRegime: "", notes: "",
};

function clientValues(c: Client): ClientForm {
  return {
    name: c.name, tradeName: c.tradeName ?? "", document: c.document ?? "",
    stateRegistration: c.stateRegistration ?? "", email: c.email ?? "", phone: c.phone ?? "",
    billingZipCode: c.billingZipCode ?? "", billingStreet: c.billingStreet ?? "",
    billingNumber: c.billingNumber ?? "", billingComplement: c.billingComplement ?? "",
    billingNeighborhood: c.billingNeighborhood ?? "", billingCity: c.billingCity ?? "",
    billingState: c.billingState ?? "",
    shippingZipCode: c.shippingZipCode ?? "", shippingStreet: c.shippingStreet ?? "",
    shippingNumber: c.shippingNumber ?? "", shippingComplement: c.shippingComplement ?? "",
    shippingNeighborhood: c.shippingNeighborhood ?? "", shippingCity: c.shippingCity ?? "",
    shippingState: c.shippingState ?? "",
    contactName: c.contactName ?? "", contactPhone: c.contactPhone ?? "",
    creditLimit: c.creditLimit ?? "", defaultDiscountPct: c.defaultDiscountPct ?? "",
    taxRegime: c.taxRegime ?? "", notes: c.notes ?? "",
  };
}

function ClientDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Client | null }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    values: editing ? clientValues(editing) : CLIENT_EMPTY,
  });

  const onSubmit = form.handleSubmit((data) => {
    const n = (v?: string) => v || null;
    const payload = {
      name: data.name, tradeName: n(data.tradeName), document: n(data.document),
      stateRegistration: n(data.stateRegistration), email: n(data.email), phone: n(data.phone),
      billingZipCode: n(data.billingZipCode), billingStreet: n(data.billingStreet),
      billingNumber: n(data.billingNumber), billingComplement: n(data.billingComplement),
      billingNeighborhood: n(data.billingNeighborhood), billingCity: n(data.billingCity),
      billingState: n(data.billingState),
      shippingZipCode: n(data.shippingZipCode), shippingStreet: n(data.shippingStreet),
      shippingNumber: n(data.shippingNumber), shippingComplement: n(data.shippingComplement),
      shippingNeighborhood: n(data.shippingNeighborhood), shippingCity: n(data.shippingCity),
      shippingState: n(data.shippingState),
      contactName: n(data.contactName), contactPhone: n(data.contactPhone),
      creditLimit: n(data.creditLimit), defaultDiscountPct: n(data.defaultDiscountPct),
      taxRegime: n(data.taxRegime), notes: n(data.notes),
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
        <DialogHeader><DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="pt-1">
          <Tabs defaultValue="geral">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="geral" className="flex-1">Geral</TabsTrigger>
              <TabsTrigger value="cobranca" className="flex-1">End. Cobrança</TabsTrigger>
              <TabsTrigger value="entrega" className="flex-1">End. Entrega</TabsTrigger>
              <TabsTrigger value="comercial" className="flex-1">Comercial</TabsTrigger>
            </TabsList>

            {/* ── Geral ── */}
            <TabsContent value="geral" className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Razão Social / Nome *</label>
                <Input {...form.register("name")} placeholder="Razão social ou nome completo" />
                {F.name && <p className="text-xs text-destructive">{F.name.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nome Fantasia</label>
                <Input {...form.register("tradeName")} placeholder="Nome fantasia (opcional)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">CNPJ / CPF</label>
                  <Input {...form.register("document")} placeholder="00.000.000/0001-00" />
                  {F.document && <p className="text-xs text-destructive">{F.document.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Insc. Estadual</label>
                  <Input {...form.register("stateRegistration")} placeholder="IE (opcional)" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">E-mail</label>
                  <Input {...form.register("email")} type="email" placeholder="contato@empresa.com" />
                  {F.email && <p className="text-xs text-destructive">{F.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Telefone</label>
                  <Input {...form.register("phone")} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nome do contato</label>
                  <Input {...form.register("contactName")} placeholder="João da Silva" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Tel. do contato</label>
                  <Input {...form.register("contactPhone")} placeholder="(11) 99999-0000" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Observações</label>
                <Textarea {...form.register("notes")} rows={2} placeholder="Opcional" />
              </div>
            </TabsContent>

            {/* ── Endereço de cobrança ── */}
            <TabsContent value="cobranca" className="space-y-3">
              <p className="text-xs text-muted-foreground">Endereço para faturamento / NF-e.</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">CEP</label>
                  <Input {...form.register("billingZipCode")} placeholder="00000-000" maxLength={9} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Logradouro</label>
                  <Input {...form.register("billingStreet")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Número</label>
                  <Input {...form.register("billingNumber")} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Complemento</label>
                  <Input {...form.register("billingComplement")} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Bairro</label>
                  <Input {...form.register("billingNeighborhood")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Cidade</label>
                  <Input {...form.register("billingCity")} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">UF</label>
                  <Input {...form.register("billingState")} placeholder="SP" maxLength={2} />
                  {F.billingState && <p className="text-xs text-destructive">{F.billingState.message}</p>}
                </div>
              </div>
            </TabsContent>

            {/* ── Endereço de entrega ── */}
            <TabsContent value="entrega" className="space-y-3">
              <p className="text-xs text-muted-foreground">Endereço para entrega / expedição. Deixe em branco se igual ao de cobrança.</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">CEP</label>
                  <Input {...form.register("shippingZipCode")} placeholder="00000-000" maxLength={9} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Logradouro</label>
                  <Input {...form.register("shippingStreet")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Número</label>
                  <Input {...form.register("shippingNumber")} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Complemento</label>
                  <Input {...form.register("shippingComplement")} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Bairro</label>
                  <Input {...form.register("shippingNeighborhood")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Cidade</label>
                  <Input {...form.register("shippingCity")} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">UF</label>
                  <Input {...form.register("shippingState")} placeholder="SP" maxLength={2} />
                  {F.shippingState && <p className="text-xs text-destructive">{F.shippingState.message}</p>}
                </div>
              </div>
            </TabsContent>

            {/* ── Comercial ── */}
            <TabsContent value="comercial" className="space-y-3">
              <p className="text-xs text-muted-foreground">Parâmetros comerciais e tributários do cliente.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Limite de crédito (R$)</label>
                  <Input {...form.register("creditLimit")} type="number" min="0" step="0.01" placeholder="0,00" />
                  {F.creditLimit && <p className="text-xs text-destructive">{F.creditLimit.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Desconto padrão (%)</label>
                  <Input {...form.register("defaultDiscountPct")} type="number" min="0" max="100" step="0.1" placeholder="0" />
                  {F.defaultDiscountPct && <p className="text-xs text-destructive">{F.defaultDiscountPct.message}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Regime Tributário</label>
                <Controller control={form.control} name="taxRegime" render={({ field }) => (
                  <select {...field} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                    <option value="">— Selecionar —</option>
                    <option value="mei">MEI</option>
                    <option value="simples">Simples Nacional</option>
                    <option value="presumido">Lucro Presumido</option>
                    <option value="real">Lucro Real</option>
                  </select>
                )} />
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
  validUntil: z.string().optional(),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
  paymentTerms: z.string().optional(),
  commission: z.string().optional(),
  freightValue: z.string().optional(),
  carrier: z.string().optional(),
  formula: z.string().optional(),
  formulaVersion: z.string().optional(),
  packagingType: z.string().optional(),
  labelRef: z.string().optional(),
  technicalNotes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Adicione pelo menos um item"),
});
type OrderForm = z.infer<typeof orderSchema>;

type Step = "comercial" | "produto" | "logistica" | "itens";

function OrderDialog({ open, onClose, editing, clients }: { open: boolean; onClose: () => void; editing?: SalesOrder | null; clients: Client[] }) {
  const qc = useQueryClient();
  const invalidateOrders = () => {
    qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetVendasDashboardQueryKey() });
  };

  const createMutation = useCreateSalesOrder();
  const updateMutation = useUpdateSalesOrder();
  const [step, setStep] = useState<Step>("comercial");

  const { data: fullOrder, isLoading: loadingOrder } = useGetSalesOrder(editing?.id ?? 0);

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { type: "quote", clientId: "", validUntil: "", deliveryDate: "", notes: "", paymentTerms: "", commission: "", freightValue: "", carrier: "", formula: "", formulaVersion: "", packagingType: "", labelRef: "", technicalNotes: "", items: [{ description: "", quantity: "1", unitPrice: "0" }] },
  });

  const [populated, setPopulated] = useState(false);
  useEffect(() => {
    if (!open) { setPopulated(false); setStep("comercial"); return; }
    if (!editing) {
      form.reset({ type: "quote", clientId: "", validUntil: "", deliveryDate: "", notes: "", paymentTerms: "", commission: "", freightValue: "", carrier: "", formula: "", formulaVersion: "", packagingType: "", labelRef: "", technicalNotes: "", items: [{ description: "", quantity: "1", unitPrice: "0" }] });
      setPopulated(true);
      return;
    }
    if (!fullOrder || populated) return;
    form.reset({
      type: fullOrder.type as "quote" | "order",
      clientId: fullOrder.clientId ? String(fullOrder.clientId) : "",
      validUntil: fullOrder.validUntil ? new Date(fullOrder.validUntil).toISOString().slice(0, 10) : "",
      deliveryDate: fullOrder.deliveryDate ? new Date(fullOrder.deliveryDate).toISOString().slice(0, 10) : "",
      notes: fullOrder.notes ?? "",
      paymentTerms: fullOrder.paymentTerms ?? "",
      commission: fullOrder.commission ?? "",
      freightValue: fullOrder.freightValue ?? "",
      carrier: fullOrder.carrier ?? "",
      formula: fullOrder.formula ?? "",
      formulaVersion: fullOrder.formulaVersion ?? "",
      packagingType: fullOrder.packagingType ?? "",
      labelRef: fullOrder.labelRef ?? "",
      technicalNotes: fullOrder.technicalNotes ?? "",
      items: fullOrder.items.length > 0
        ? fullOrder.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice }))
        : [{ description: "", quantity: "1", unitPrice: "0" }],
    });
    setPopulated(true);
  }, [open, editing, fullOrder, populated, form]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = form.watch("items");
  const total = watchedItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

  const [creditError, setCreditError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit((data) => {
    setCreditError(null);
    const payload = {
      type: data.type,
      clientId: data.clientId ? parseInt(data.clientId) : null,
      validUntil: data.validUntil ? new Date(data.validUntil + "T00:00:00").toISOString() : null,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate + "T00:00:00").toISOString() : null,
      notes: data.notes || null,
      paymentTerms: data.paymentTerms || null,
      commission: data.commission || null,
      freightValue: data.freightValue || null,
      carrier: data.carrier || null,
      formula: data.formula || null,
      formulaVersion: data.formulaVersion || null,
      packagingType: data.packagingType || null,
      labelRef: data.labelRef || null,
      technicalNotes: data.technicalNotes || null,
      items: data.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload as any }, { onSuccess: () => { invalidateOrders(); onClose(); } });
    } else {
      createMutation.mutate({ data: payload as any }, {
        onSuccess: () => { invalidateOrders(); onClose(); form.reset(); },
        onError: (err: any) => {
          const body = err?.data ?? err;
          if (body?.code === "credit_limit_exceeded" || (typeof body?.error === "string" && body.error.includes("Limite de crédito"))) {
            setCreditError(body.error ?? "Limite de crédito excedido para este cliente.");
          }
        },
      });
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending || loadingOrder;
  const steps: { key: Step; label: string }[] = [
    { key: "comercial", label: "Comercial" },
    { key: "produto", label: "Produto/Fórmula" },
    { key: "logistica", label: "Logística" },
    { key: "itens", label: "Itens" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar" : "Novo"} {form.watch("type") === "quote" ? "Orçamento" : "Pedido de Venda"}</DialogTitle>
        </DialogHeader>

        {/* Step nav */}
        <div className="flex gap-1 border-b pb-3">
          {steps.map((s, i) => (
            <button key={s.key} type="button" onClick={() => setStep(s.key)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${step === s.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]">{i+1}</span>
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          {/* Step 1: Comercial */}
          {step === "comercial" && (
            <div className="space-y-3">
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
                  <label className="text-sm font-medium">Cliente</label>
                  <Controller control={form.control} name="clientId" render={({ field }) => (
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sem cliente —</SelectItem>
                        {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Validade (orçamento)</label>
                  <Input type="date" {...form.register("validUntil")} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Prazo de Entrega</label>
                  <Input type="date" {...form.register("deliveryDate")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Condição de Pagamento</label>
                  <Input {...form.register("paymentTerms")} placeholder="Ex: 30/60/90 DDL" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Comissão (%)</label>
                  <Input {...form.register("commission")} placeholder="Ex: 5.00" type="number" step="0.01" min="0" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Observações</label>
                <Input {...form.register("notes")} placeholder="Observações comerciais" />
              </div>
            </div>
          )}

          {/* Step 2: Produto/Fórmula */}
          {step === "produto" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Fórmula / Produto</label>
                  <Input {...form.register("formula")} placeholder="Ex: Whey Protein Concentrado" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Versão da Fórmula</label>
                  <Input {...form.register("formulaVersion")} placeholder="Ex: v3.2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Tipo de Embalagem</label>
                  <Input {...form.register("packagingType")} placeholder="Ex: Pote 900g, Sachê 30g" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Referência do Rótulo</label>
                  <Input {...form.register("labelRef")} placeholder="Ex: ROT-2024-001" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Notas Técnicas</label>
                <Textarea {...form.register("technicalNotes")} placeholder="Requisitos técnicos, especificações, restrições…" rows={4} />
              </div>
            </div>
          )}

          {/* Step 3: Logística */}
          {step === "logistica" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Transportadora</label>
                  <Input {...form.register("carrier")} placeholder="Ex: Jamef, TNT, Jadlog" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Valor do Frete (R$)</label>
                  <Input {...form.register("freightValue")} placeholder="0.00" type="number" step="0.01" min="0" />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Itens */}
          {step === "itens" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Itens do Pedido</label>
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
          )}

          {creditError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{creditError}</span>
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-between">
            <div className="flex gap-2">
              {step !== "comercial" && (
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setStep(steps[steps.findIndex((s) => s.key === step) - 1]!.key)}>
                  ← Anterior
                </Button>
              )}
              {step !== "itens" && (
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setStep(steps[steps.findIndex((s) => s.key === step) + 1]!.key)}>
                  Próximo →
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Salvar"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Transition Dialog ──────────────────────────────────────────────────

function StatusTransitionDialog({
  open, onClose, orderId, transition, onSuccess,
}: {
  open: boolean; onClose: () => void; orderId: number;
  transition: Transition | null; onSuccess: () => void;
}) {
  const statusMutation = useUpdateSalesOrderStatus();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const handleConfirm = () => {
    if (!transition) return;
    statusMutation.mutate(
      { id: orderId, data: { status: transition.to as any, notes: note || null } },
      { onSuccess: () => { onSuccess(); onClose(); } }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{transition?.label}</AlertDialogTitle>
          <AlertDialogDescription>
            {transition?.requiresNote
              ? "Justificativa obrigatória para esta transição."
              : "Confirmar a mudança de status?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder={transition?.requiresNote ? "Justificativa (obrigatória)…" : "Observação (opcional)…"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={statusMutation.isPending || (!!transition?.requiresNote && !note.trim())}
            onClick={handleConfirm}>
            {statusMutation.isPending ? "Processando…" : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Order Detail Sheet ────────────────────────────────────────────────────────

function OrderDetailSheet({
  open, onClose, order, onStatusChange, clients,
}: {
  open: boolean; onClose: () => void; order: SalesOrder | null;
  onStatusChange: () => void; clients: Client[];
}) {
  const { data: fullOrder } = useGetSalesOrder(order?.id ?? 0);
  const { data: logs = [] } = useListSalesOrderLogs(order?.id ?? 0);
  const [pendingTransition, setPendingTransition] = useState<Transition | null>(null);

  if (!order) return null;

  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  const transitions = TRANSITIONS[order.status] ?? [];
  const isTerminal = TERMINAL_STATUSES.includes(order.status);

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <span>Pedido #{order.id}</span>
              <StatusBadge status={order.status} />
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 py-4">
            {/* Action buttons */}
            {!isTerminal && transitions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avançar Status</p>
                <div className="flex flex-wrap gap-2">
                  {transitions.map((t) => (
                    <Button key={t.to} size="sm" variant={t.variant ?? "default"} onClick={() => setPendingTransition(t)}>
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Details */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados Comerciais</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{order.clientName ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{order.type === "quote" ? "Orçamento" : "Pedido"}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-semibold">{fmt(order.totalAmount)}</span></div>
                <div><span className="text-muted-foreground">Validade:</span> <span>{fmtDate(order.validUntil)}</span></div>
                <div><span className="text-muted-foreground">Prazo entrega:</span> <span>{fmtDate(order.deliveryDate)}</span></div>
                <div><span className="text-muted-foreground">Cond. pagamento:</span> <span>{order.paymentTerms ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Comissão:</span> <span>{order.commission ? `${order.commission}%` : "—"}</span></div>
                <div><span className="text-muted-foreground">Frete:</span> <span>{order.freightValue ? fmt(order.freightValue) : "—"}</span></div>
                <div><span className="text-muted-foreground">Transportadora:</span> <span>{order.carrier ?? "—"}</span></div>
              </div>

              {(order.formula || order.formulaVersion || order.packagingType || order.labelRef) && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">Produto/Fórmula</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">Fórmula:</span> <span>{order.formula ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">Versão:</span> <span>{order.formulaVersion ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">Embalagem:</span> <span>{order.packagingType ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">Ref. rótulo:</span> <span>{order.labelRef ?? "—"}</span></div>
                  </div>
                </>
              )}

              {order.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Observações:</span> <span>{order.notes}</span></div>
              )}
              {order.technicalNotes && (
                <div className="text-sm"><span className="text-muted-foreground">Notas técnicas:</span> <span className="whitespace-pre-wrap">{order.technicalNotes}</span></div>
              )}
            </div>

            {/* Items */}
            {fullOrder && fullOrder.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens</p>
                <div className="rounded border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fullOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(item.unitPrice)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{fmt(item.totalPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <History className="h-3 w-3" /> Histórico de Status
              </p>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem registros de transição</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="w-px bg-border flex-1 mt-1" />
                      </div>
                      <div className="pb-3 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.fromStatus && (
                            <>
                              <StatusBadge status={log.fromStatus} />
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            </>
                          )}
                          <StatusBadge status={log.toStatus} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtDateTime(log.createdAt)}
                          {log.userName && <span className="ml-1 font-medium">— {log.userName}</span>}
                        </p>
                        {log.notes && <p className="text-xs text-foreground/80 mt-0.5 italic">"{log.notes}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <StatusTransitionDialog
        open={!!pendingTransition}
        onClose={() => setPendingTransition(null)}
        orderId={order.id}
        transition={pendingTransition}
        onSuccess={onStatusChange}
      />
    </>
  );
}

// ─── Pipeline (Kanban) View ────────────────────────────────────────────────────

function PipelineView({
  orders, onOrderClick, onDndDrop,
}: {
  orders: SalesOrder[];
  onOrderClick: (o: SalesOrder) => void;
  onDndDrop: (order: SalesOrder, toStatus: OrderStatus) => void;
}) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrderStatus | null>(null);
  const draggingOrder = orders.find((o) => o.id === draggingId) ?? null;

  const columns = PIPELINE_STAGES.map((status) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    orders: orders.filter((o) => o.status === status && o.type === "order"),
  }));

  const handleDrop = (targetStatus: OrderStatus) => {
    if (draggingOrder && draggingOrder.status !== targetStatus) {
      onDndDrop(draggingOrder, targetStatus);
    }
    setDraggingId(null);
    setDragOverStatus(null);
  };

  return (
    <div className="overflow-x-auto pb-4">
      <p className="text-xs text-muted-foreground mb-3">Arraste os cartões entre colunas para mover o pedido de estágio.</p>
      <div className="flex gap-3 min-w-max">
        {columns.map((col) => (
          <div
            key={col.status}
            className={`w-52 flex-shrink-0 rounded-lg p-1 transition-colors ${dragOverStatus === col.status ? "bg-primary/5 ring-1 ring-primary/30" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.status); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStatus(null); }}
            onDrop={() => handleDrop(col.status)}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{col.label}</span>
              <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5">{col.orders.length}</span>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {col.orders.map((order) => (
                <div key={order.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingId(order.id); }}
                  onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                  onClick={() => onOrderClick(order)}
                  className={`bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-primary/40 transition-all select-none ${draggingId === order.id ? "opacity-50 scale-95" : ""}`}>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">#{order.id}</span>
                    {order.deliveryDate && new Date(order.deliveryDate) < new Date() && (
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium leading-tight truncate">{order.clientName ?? "Sem cliente"}</p>
                  {order.formula && <p className="text-xs text-muted-foreground truncate mt-0.5">{order.formula}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-semibold tabular-nums">{fmt(order.totalAmount)}</span>
                    {order.deliveryDate && (
                      <span className="text-xs text-muted-foreground">{fmtDate(order.deliveryDate)}</span>
                    )}
                  </div>
                </div>
              ))}
              {col.orders.length === 0 && (
                <div className={`border-2 border-dashed rounded-lg h-16 flex items-center justify-center transition-colors ${dragOverStatus === col.status ? "border-primary/50 bg-primary/5" : ""}`}>
                  <span className="text-xs text-muted-foreground">{dragOverStatus === col.status ? "Soltar aqui" : "Vazio"}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function VendasPage() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [clientSearch, setClientSearch] = useState("");
  const [clientDialog, setClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [clientsPage, setClientsPage] = useState(1);

  const [orderType, setOrderType] = useState<string>("all");
  const [orderStatus, setOrderStatus] = useState<string>("all");
  const [ordersPage, setOrdersPage] = useState(1);
  const [orderDialog, setOrderDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<SalesOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);

  const invalidateOrders = () => {
    qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetVendasDashboardQueryKey() });
  };

  const PAGE_SIZE = 20;

  const { data: clientsData } = useListClients({ page: clientsPage, pageSize: PAGE_SIZE });
  const { data: allClientsData } = useListClients({ pageSize: 500 });
  const { data: topDebtors = [] } = useGetClientTopDebtors({ limit: 8 });
  const clients = clientsData?.items ?? [];
  const activeClients = useMemo(() => (allClientsData?.items ?? []).filter((c) => c.active === "true"), [allClientsData]);

  const ordersParams = useMemo(() => ({
    ...(orderType !== "all" ? { type: orderType as "quote" | "order" } : {}),
    ...(orderStatus !== "all" ? { status: orderStatus as any } : {}),
    page: ordersPage,
    pageSize: PAGE_SIZE,
  }), [orderType, orderStatus, ordersPage]);

  useEffect(() => { setOrdersPage(1); }, [orderType, orderStatus]);
  useEffect(() => { setClientsPage(1); }, [clientSearch]);

  const { data: ordersData, isLoading: ordersLoading } = useListSalesOrders(ordersParams);
  const orders = ordersData?.items ?? [];
  const { data: dashboard } = useGetVendasDashboard({ year: currentYear });

  const { data: allOrdersData } = useListSalesOrders({ pageSize: 500 });
  const allOrders = allOrdersData?.items ?? [];

  const deleteCMutation = useDeleteClient();
  const deleteOMutation = useDeleteSalesOrder();
  const convertMutation = useConvertQuoteToOrder();
  const dndStatusMutation = useUpdateSalesOrderStatus();

  const handleDndDrop = (order: SalesOrder, toStatus: OrderStatus) => {
    if (order.status === toStatus) return;
    const transitions = TRANSITIONS[order.status as OrderStatus] ?? [];
    const t = transitions.find((tr) => tr.to === toStatus);
    if (!t) return;
    if (t.requiresNote) {
      setDetailOrder(order);
    } else {
      dndStatusMutation.mutate(
        { id: order.id, data: { status: toStatus } },
        { onSuccess: () => invalidateOrders() }
      );
    }
  };

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

  // Funnel data for pipeline
  const funnelData = (dashboard?.pipelineByStatus ?? [])
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: STATUS_LABELS[s.status] ?? s.status,
      value: s.count,
      fill: "hsl(var(--primary))",
    }));

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Vendas / Comercial"
          subtitle="Clientes, orçamentos e pedidos de venda"
          actions={
            <Button onClick={() => { setEditingOrder(null); setOrderDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo
            </Button>
          }
        />

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="orders">Orçamentos & Pedidos</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendas este mês</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{fmt(dashboard?.totalThisMonth ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{dashboard?.ordersThisMonth ?? 0} pedidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket Médio</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold tabular-nums">{fmt(dashboard?.avgTicket ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Por pedido ({currentYear})</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Em aberto</CardTitle>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold">{dashboard?.openOrders ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pedidos ativos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Atrasados</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold text-destructive">{dashboard?.overdueOrders ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Prazo vencido</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Orçamentos</CardTitle>
                  <FileText className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold">{dashboard?.totalQuotes ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{currentYear}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conversão</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold">{dashboard?.conversionRate ?? 0}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Orçamento → pedido</p>
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
                        <span className="text-sm font-medium truncate max-w-[120px]">{c.clientName}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{fmt(c.total)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Pipeline summary */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Pipeline Atual</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-0 overflow-x-auto">
                  {(dashboard?.pipelineByStatus ?? []).map((stage, i) => (
                    <div key={stage.status} className="flex items-center gap-0">
                      <div className={`text-center px-3 py-2 min-w-[80px] ${stage.count > 0 ? "opacity-100" : "opacity-40"}`}>
                        <p className="text-lg font-bold">{stage.count}</p>
                        <p className="text-xs text-muted-foreground leading-tight">{STATUS_LABELS[stage.status]}</p>
                      </div>
                      {i < (dashboard?.pipelineByStatus ?? []).length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                  {(dashboard?.pipelineByStatus ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum pedido em aberto</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Overdue orders table */}
            {(() => {
              const overdueList = allOrders.filter(
                (o) =>
                  o.type === "order" &&
                  o.deliveryDate &&
                  new Date(o.deliveryDate) < new Date() &&
                  !TERMINAL_STATUSES.includes(o.status)
              );
              if (overdueList.length === 0) return null;
              return (
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" /> Pedidos com Prazo Vencido ({overdueList.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Fórmula</TableHead>
                          <TableHead>Prazo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overdueList.map((order) => (
                          <TableRow key={order.id} className="cursor-pointer" onClick={() => setDetailOrder(order)}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{order.id}</TableCell>
                            <TableCell className="font-medium">{order.clientName ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{order.formula ?? "—"}</TableCell>
                            <TableCell className="text-sm text-destructive font-medium">{fmtDate(order.deliveryDate)}</TableCell>
                            <TableCell><StatusBadge status={order.status} /></TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{fmt(order.totalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>

          {/* ── PIPELINE TAB ──────────────────────────────────────────────── */}
          <TabsContent value="pipeline" className="mt-4">
            <PipelineView
              orders={allOrders}
              onOrderClick={(o) => setDetailOrder(o)}
              onDndDrop={handleDndDrop}
            />
          </TabsContent>

          {/* ── ORDERS TAB ────────────────────────────────────────────────── */}
          <TabsContent value="orders" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3 flex-wrap">
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="quote">Orçamento</SelectItem>
                    <SelectItem value="order">Pedido</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={orderStatus} onValueChange={setOrderStatus}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
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
                      <TableHead>Fórmula</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
                    )}
                    {!ordersLoading && orders.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhum registro encontrado</TableCell></TableRow>
                    )}
                    {orders.map((order) => {
                      const isOverdue = order.deliveryDate && new Date(order.deliveryDate) < new Date() && !TERMINAL_STATUSES.includes(order.status);
                      return (
                        <TableRow key={order.id} className="cursor-pointer" onClick={() => setDetailOrder(order)}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{order.id}</TableCell>
                          <TableCell>
                            <StatusBadge status={order.type === "quote" ? "quote" : "confirmed"} label={order.type === "quote" ? "Orçamento" : "Pedido"} showIcon={false} />
                          </TableCell>
                          <TableCell className="font-medium">{order.clientName ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{order.formula ?? "—"}</TableCell>
                          <TableCell className={`text-sm ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {fmtDate(order.deliveryDate)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{fmt(order.totalAmount)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              {order.type === "quote" && !TERMINAL_STATUSES.includes(order.status) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Converter em pedido"
                                  onClick={() => convertMutation.mutate({ id: order.id }, { onSuccess: () => invalidateOrders() })}
                                  disabled={convertMutation.isPending}>
                                  <ArrowRightCircle className="h-4 w-4" />
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
                {(ordersData?.totalPages ?? 1) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">Página {ordersData?.page} de {ordersData?.totalPages} — {ordersData?.total} registros</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setOrdersPage((p) => Math.max(1, p - 1))} disabled={ordersPage <= 1}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setOrdersPage((p) => p + 1)} disabled={ordersPage >= (ordersData?.totalPages ?? 1)}>Próxima</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CLIENTS TAB ───────────────────────────────────────────────── */}
          <TabsContent value="clients" className="space-y-4 mt-4">
            {/* Top Debtors Panel */}
            {topDebtors.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Exposição de Crédito — Top Devedores
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="space-y-3">
                    {topDebtors.map((debtor) => {
                      const pct = Math.min(100, debtor.creditPct);
                      const over = debtor.creditPct > 100;
                      return (
                        <div key={debtor.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate max-w-[200px]">{debtor.name}</span>
                            <span className={`text-xs tabular-nums ${over ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                              {fmt(debtor.creditUsed)} / {debtor.creditLimit ? fmt(debtor.creditLimit) : "—"}
                              {over && <span className="ml-1 font-bold">({debtor.creditPct}%)</span>}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${over ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

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
                      <TableHead>Crédito Utilizado</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum cliente encontrado</TableCell></TableRow>
                    )}
                    {filteredClients.map((client) => {
                      const used = parseFloat(client.creditUsed ?? "0");
                      const limit = parseFloat(client.creditLimit ?? "0");
                      const hasLimit = limit > 0;
                      const pct = hasLimit ? Math.min(100, Math.round(used / limit * 100)) : 0;
                      const over = hasLimit && used > limit;
                      return (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">{client.document ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{client.email ?? "—"}</TableCell>
                          <TableCell className="min-w-[160px]">
                            {hasLimit ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-xs tabular-nums ${over ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                    {fmt(used)} / {fmt(limit)}
                                  </span>
                                  {over && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${over ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem limite</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {[client.billingCity, client.billingState].filter(Boolean).join("/") ||
                             [client.city, client.state].filter(Boolean).join("/") || "—"}
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
                      );
                    })}
                  </TableBody>
                </Table>
                {(clientsData?.totalPages ?? 1) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">Página {clientsData?.page} de {clientsData?.totalPages} — {clientsData?.total} registros</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setClientsPage((p) => Math.max(1, p - 1))} disabled={clientsPage <= 1}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setClientsPage((p) => p + 1)} disabled={clientsPage >= (clientsData?.totalPages ?? 1)}>Próxima</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs / Sheets ────────────────────────────────────────────── */}
      <ClientDialog open={clientDialog} onClose={() => { setClientDialog(false); setEditingClient(null); }} editing={editingClient} />

      <OrderDialog open={orderDialog} onClose={() => { setOrderDialog(false); setEditingOrder(null); }} editing={editingOrder} clients={activeClients} />

      <OrderDetailSheet
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        order={detailOrder}
        onStatusChange={invalidateOrders}
        clients={activeClients}
      />

      <AlertDialog open={!!deleteClient} onOpenChange={(v) => !v && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteClient?.name}" será marcado como inativo.</AlertDialogDescription>
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
            <AlertDialogDescription>O #{deleteOrder?.id} será removido permanentemente.</AlertDialogDescription>
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
