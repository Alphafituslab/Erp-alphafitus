import { useState, useCallback, useRef } from "react";
import {
  useSearchTraceLots,
  useGetTraceabilityTrace,
  useGetTraceabilityForward,
  useGetTraceabilityBackward,
  useGetTraceabilityAlerts,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Printer,
  Package,
  Factory,
  ShoppingCart,
  Truck,
  FlaskConical,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  XCircle,
  Bell,
  Users,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function fmt(d?: string | Date | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return "—"; }
}

function fmtTs(d?: string | Date | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return "—"; }
}

function CqBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline" className="text-xs">Sem CQ</Badge>;
  const map: Record<string, { label: string; className: string }> = {
    approved:   { label: "Aprovado",   className: "bg-green-500/20 text-green-300 border-green-500/40" },
    rejected:   { label: "Reprovado",  className: "bg-red-500/20 text-red-300 border-red-500/40" },
    pending:    { label: "Pendente",   className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
    quarantine: { label: "Quarentena", className: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-300 border-gray-500/40" };
  return <Badge className={`text-xs border ${cfg.className}`}>{cfg.label}</Badge>;
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const m: Record<string, string> = {
    draft: "Rascunho", confirmed: "Confirmado", in_progress: "Em andamento",
    completed: "Concluído", cancelled: "Cancelado", approved: "Aprovado",
    rejected: "Reprovado", pending: "Pendente", released: "Liberado",
  };
  return <Badge variant="outline" className="text-xs">{m[status] ?? status}</Badge>;
}

function SectionToggle({ title, icon: Icon, iconColor, count, children }: {
  title: string; icon: React.ElementType; iconColor: string; count?: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
      >
        <Icon className={`h-4 w-4 ${iconColor} shrink-0`} />
        <span className="font-medium text-sm text-white/90">{title}</span>
        {count !== undefined && (
          <Badge className="ml-1 text-xs bg-white/10 text-white/60 border-white/20">{count}</Badge>
        )}
        <span className="ml-auto">
          {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRightIcon className="h-4 w-4 text-white/40" />}
        </span>
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | number | null | React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-white/40 min-w-[130px] shrink-0">{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  );
}

function GridCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg bg-white/5 border border-white/10 p-3 space-y-1.5 ${className}`}>
      {children}
    </div>
  );
}

function ForwardView({ lot }: { lot: string }) {
  const { data: fw, isLoading, error } = useGetTraceabilityForward(
    { lot },
    { query: { enabled: !!lot } as any }
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-3 text-white/40">
      <Clock className="h-5 w-5 animate-spin" /><span>Calculando rastreabilidade direta…</span>
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-3 py-8 text-red-300 text-sm">
      <XCircle className="h-4 w-4" />Lote não encontrado como matéria-prima.
    </div>
  );
  if (!fw) return null;

  return (
    <div className="space-y-4">
      {fw.mpLotInfo && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4 pb-4 space-y-1.5">
            <DataRow label="Produto" value={(fw.mpLotInfo as any)?.productName} />
            <DataRow label="Lote Fornecedor" value={(fw.mpLotInfo as any)?.supplierLot} />
            <DataRow label="Qtd Total" value={(fw.mpLotInfo as any)?.totalQty !== undefined ? `${(fw.mpLotInfo as any).totalQty} un` : null} />
            <DataRow label="Status CQ" value={<CqBadge status={(fw.mpLotInfo as any)?.cqStatus} />} />
            <DataRow label="Fabricação" value={fmt((fw.mpLotInfo as any)?.manufacturingDate)} />
            <DataRow label="Validade" value={fmt((fw.mpLotInfo as any)?.expirationDate)} />
          </CardContent>
        </Card>
      )}

      {(fw.cqAnalyses as any[])?.length > 0 && (
        <SectionToggle title="Análises CQ" icon={FlaskConical} iconColor="text-teal-400" count={(fw.cqAnalyses as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(fw.cqAnalyses as any[]).map((a: any) => (
              <GridCard key={a.id}>
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-white/80">{a.sampleCode}</span><StatusBadge status={a.status} /></div>
                <DataRow label="Tipo" value={a.analysisType} />
                <DataRow label="Analista" value={a.analystName} />
                <DataRow label="Concluído" value={fmtTs(a.completedAt)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(fw.cqCertificates as any[])?.length > 0 && (
        <SectionToggle title="Certificados de Qualidade" icon={CheckCircle2} iconColor="text-green-400" count={(fw.cqCertificates as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(fw.cqCertificates as any[]).map((c: any) => (
              <GridCard key={c.id}>
                <div className="font-medium text-sm text-white/90">{c.certificateNumber ?? `Cert #${c.id}`}</div>
                <DataRow label="Emitido" value={fmt(c.issuedAt)} />
                <DataRow label="Válido até" value={fmt(c.validUntil)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(fw.consumptions as any[])?.length > 0 && (
        <SectionToggle title="Consumos em OPs" icon={Factory} iconColor="text-rose-400" count={(fw.consumptions as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(fw.consumptions as any[]).map((c: any) => (
              <GridCard key={c.id}>
                <div className="font-medium text-sm text-white/90">{c.productName}</div>
                <DataRow label="Qtd Real" value={c.actualQty !== undefined ? `${c.actualQty} ${c.unit ?? ""}` : null} />
                <DataRow label="Registrado por" value={c.recordedBy} />
                <DataRow label="Data" value={fmtTs(c.recordedAt)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(fw.productionOrders as any[])?.length > 0 && (
        <SectionToggle title="Ordens de Produção" icon={Factory} iconColor="text-amber-400" count={(fw.productionOrders as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(fw.productionOrders as any[]).map((op: any) => (
              <GridCard key={op.id}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">OP {op.number}</span><StatusBadge status={op.status} /></div>
                <DataRow label="Produto" value={op.productName} />
                <DataRow label="Lote PA" value={op.batchLot} />
                <DataRow label="Qtd Plan." value={op.plannedQty !== undefined ? `${op.plannedQty} ${op.unit ?? ""}` : null} />
                <DataRow label="Início" value={fmt(op.scheduledStart)} />
                <DataRow label="Fim" value={fmt(op.scheduledEnd)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(fw.paLots as any[])?.length > 0 && (
        <SectionToggle title="Lotes de Produto Acabado" icon={Package} iconColor="text-blue-400" count={(fw.paLots as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(fw.paLots as any[]).map((l: any) => (
              <GridCard key={l.id}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{l.internalLot}</span><CqBadge status={l.cqStatus} /></div>
                <DataRow label="Produto" value={l.productName} />
                <DataRow label="Qtd Total" value={l.totalQty !== undefined ? `${l.totalQty} un` : null} />
                <DataRow label="Validade" value={fmt(l.expirationDate)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(fw.salesOrders as any[])?.length > 0 && (
        <SectionToggle title="Pedidos de Venda" icon={ShoppingCart} iconColor="text-sky-400" count={(fw.salesOrders as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(fw.salesOrders as any[]).map((so: any) => (
              <GridCard key={so.id}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{so.clientName ?? "—"}</span><StatusBadge status={so.status} /></div>
                <DataRow label="Documento" value={so.clientDocument} />
                <DataRow label="Cidade" value={so.clientCity ? `${so.clientCity}/${so.clientState}` : null} />
                <DataRow label="Total" value={so.totalAmount !== undefined ? `R$ ${Number(so.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
                <DataRow label="Entrega" value={fmt(so.deliveryDate)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(fw.fiscalDocs as any[])?.length > 0 && (
        <SectionToggle title="Documentos Fiscais" icon={FileText} iconColor="text-purple-400" count={(fw.fiscalDocs as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(fw.fiscalDocs as any[]).map((d: any) => (
              <GridCard key={d.id}>
                <div className="font-medium text-sm text-white/90">{d.documentType?.toUpperCase()} {d.number ? `nº ${d.number}` : `#${d.id}`}</div>
                <DataRow label="Status" value={<StatusBadge status={d.status} />} />
                <DataRow label="Emissão" value={fmt(d.issueDate)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {!(fw.consumptions as any[])?.length && !(fw.productionOrders as any[])?.length && !(fw.paLots as any[])?.length && (
        <div className="text-center py-8 text-white/30 text-sm border border-white/10 rounded-lg">
          Nenhuma rastreabilidade direta encontrada para este lote de MP.
        </div>
      )}
    </div>
  );
}

function BackwardView({ lot }: { lot: string }) {
  const { data: bw, isLoading, error } = useGetTraceabilityBackward(
    { lot },
    { query: { enabled: !!lot } as any }
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-3 text-white/40">
      <Clock className="h-5 w-5 animate-spin" /><span>Calculando rastreabilidade reversa…</span>
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-3 py-8 text-red-300 text-sm">
      <XCircle className="h-4 w-4" />Lote não encontrado como produto acabado de OP.
    </div>
  );
  if (!bw) return null;

  return (
    <div className="space-y-4">
      {(bw.productionOrders as any[])?.length > 0 && (
        <SectionToggle title="Ordens de Produção (Origem)" icon={Factory} iconColor="text-rose-400" count={(bw.productionOrders as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(bw.productionOrders as any[]).map((op: any) => (
              <GridCard key={op.id}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">OP {op.number}</span><StatusBadge status={op.status} /></div>
                <DataRow label="Produto" value={op.productName} />
                <DataRow label="Lote PA" value={op.batchLot} />
                <DataRow label="Qtd Real" value={op.actualQty !== undefined ? `${op.actualQty} ${op.unit ?? ""}` : null} />
                <DataRow label="Início real" value={fmtTs(op.actualStart)} />
                <DataRow label="Fim real" value={fmtTs(op.actualEnd)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(bw.consumedMpLots as any[])?.length > 0 && (
        <SectionToggle title="Matérias-Primas Consumidas" icon={Package} iconColor="text-amber-400" count={(bw.consumedMpLots as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(bw.consumedMpLots as any[]).map((c: any, i: number) => (
              <GridCard key={c.id ?? i}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{c.productName}</span><CqBadge status={c.cqStatus} /></div>
                <DataRow label="Lote Interno" value={c.internalLot} />
                <DataRow label="Lote Fornecedor" value={c.supplierLot} />
                <DataRow label="Qtd Real" value={c.actualQty !== undefined ? `${c.actualQty} ${c.unit ?? ""}` : null} />
                <DataRow label="Data" value={fmtTs(c.recordedAt)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(bw.mpLots as any[])?.length > 0 && (
        <SectionToggle title="Lotes de MP (Detalhes)" icon={Package} iconColor="text-blue-400" count={(bw.mpLots as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(bw.mpLots as any[]).map((l: any) => (
              <GridCard key={l.id}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{l.internalLot}</span><CqBadge status={l.cqStatus} /></div>
                <DataRow label="Produto" value={l.productName} />
                <DataRow label="Lote Forn." value={l.supplierLot} />
                <DataRow label="Qtd Total" value={l.totalQty !== undefined ? `${l.totalQty} un` : null} />
                <DataRow label="Validade" value={fmt(l.expirationDate)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(bw.suppliers as any[])?.length > 0 && (
        <SectionToggle title="Fornecedores" icon={Truck} iconColor="text-purple-400" count={(bw.suppliers as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(bw.suppliers as any[]).map((s: any) => (
              <GridCard key={s.id}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{s.supplierName ?? "—"}</span><Badge variant="outline" className="text-xs">{s.supplierApprovalStatus ?? "—"}</Badge></div>
                <DataRow label="CNPJ" value={s.supplierDocument} />
                <DataRow label="Cidade" value={s.supplierCity ? `${s.supplierCity}/${s.supplierState}` : null} />
                <DataRow label="NF Entrada" value={s.nfNumber} />
                <DataRow label="Recebimento" value={fmt(s.receivedAt)} />
                <DataRow label="Valor NF" value={s.totalAmount !== undefined ? `R$ ${Number(s.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(bw.qualityAnalyses as any[])?.length > 0 && (
        <SectionToggle title="Análises CQ das MPs" icon={FlaskConical} iconColor="text-teal-400" count={(bw.qualityAnalyses as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(bw.qualityAnalyses as any[]).map((a: any) => (
              <GridCard key={a.id}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{a.sampleCode}</span><StatusBadge status={a.status} /></div>
                <DataRow label="Lote" value={a.internalLot} />
                <DataRow label="Tipo" value={a.analysisType} />
                <DataRow label="Analista" value={a.analystName} />
                <DataRow label="Concluído" value={fmtTs(a.completedAt)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(bw.ncrs as any[])?.length > 0 && (
        <SectionToggle title="Não Conformidades (NCRs)" icon={AlertTriangle} iconColor="text-red-400" count={(bw.ncrs as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(bw.ncrs as any[]).map((n: any) => (
              <GridCard key={n.id}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-white/90">{n.title}</span>
                  <Badge className={`text-xs border ${n.severity === "critical" ? "bg-red-500/20 text-red-300 border-red-500/40" : n.severity === "high" ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"}`}>{n.severity}</Badge>
                </div>
                <DataRow label="Produto" value={n.productName} />
                <DataRow label="Tipo" value={n.ncType} />
                <DataRow label="Status" value={<StatusBadge status={n.status} />} />
                <DataRow label="Reportado" value={fmt(n.createdAt)} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {(bw.salesOrders as any[])?.length > 0 && (
        <SectionToggle title="Pedidos de Venda Associados" icon={ShoppingCart} iconColor="text-sky-400" count={(bw.salesOrders as any[]).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(bw.salesOrders as any[]).map((so: any) => (
              <GridCard key={so.id}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{so.clientName ?? "—"}</span><StatusBadge status={so.status} /></div>
                <DataRow label="Documento" value={so.clientDocument} />
                <DataRow label="Cidade" value={so.clientCity} />
                <DataRow label="Total" value={so.totalAmount !== undefined ? `R$ ${Number(so.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
              </GridCard>
            ))}
          </div>
        </SectionToggle>
      )}

      {!(bw.consumedMpLots as any[])?.length && !(bw.mpLots as any[])?.length && !(bw.suppliers as any[])?.length && (
        <div className="text-center py-8 text-white/30 text-sm border border-white/10 rounded-lg">
          Nenhuma rastreabilidade reversa encontrada para este lote de PA.
        </div>
      )}
    </div>
  );
}

function AlertsPanel() {
  const { data, isLoading, error, refetch, isFetching } = useGetTraceabilityAlerts();
  const alerts = (data as any)?.alerts ?? [];
  const totalLots = (data as any)?.totalLots ?? 0;
  const totalOps = (data as any)?.totalOpsAffected ?? 0;
  const totalClients = (data as any)?.totalClientsExposed ?? 0;

  const handlePrintAlerts = () => window.print();

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-3 text-white/40">
      <Clock className="h-5 w-5 animate-spin" /><span>Carregando painel de alertas…</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 py-8 text-red-300 text-sm border border-red-500/20 rounded-lg px-4">
      <XCircle className="h-4 w-4 shrink-0" />Erro ao carregar alertas de rastreabilidade.
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-red-300">{totalLots}</div>
            <div className="text-xs text-red-200/70 mt-1">Lotes Críticos</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-amber-300">{totalOps}</div>
            <div className="text-xs text-amber-200/70 mt-1">OPs Afetadas</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-orange-300">{totalClients}</div>
            <div className="text-xs text-orange-200/70 mt-1">Clientes Expostos</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between no-print">
        <p className="text-xs text-white/40">
          {totalLots === 0
            ? "Nenhum lote crítico encontrado. Sistema íntegro."
            : `${totalLots} lote${totalLots > 1 ? "s" : ""} com status crítico de CQ podem ter impacto nas OPs e clientes.`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/20 text-white/60 hover:text-white text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {alerts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-white/20 text-white/60 hover:text-white text-xs"
              onClick={handlePrintAlerts}
            >
              <Printer className="h-3.5 w-3.5" />
              Exportar PDF
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 border border-green-500/20 rounded-lg bg-green-500/5">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
          <p className="text-green-300 font-medium">Nenhum lote crítico detectado</p>
          <p className="text-xs text-white/30 max-w-xs text-center">
            Todos os lotes estão aprovados ou pendentes de análise. Nenhuma ação de recall necessária.
          </p>
        </div>
      )}

      {/* Alert cards */}
      {alerts.map((alert: any) => {
        const isRejected = alert.cqStatus === "rejected";
        const hasImpact = alert.opsAffectedCount > 0 || alert.clientsExposedCount > 0;
        return (
          <Card
            key={alert.lotId}
            className={`border ${isRejected ? "border-red-500/40 bg-red-500/5" : "border-orange-500/40 bg-orange-500/5"}`}
          >
            <CardContent className="pt-4 pb-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{alert.internalLot}</span>
                    <CqBadge status={alert.cqStatus} />
                    {hasImpact && (
                      <Badge className="text-xs bg-red-600/30 text-red-200 border-red-500/40 border gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        IMPACTO DETECTADO
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-white/50">{alert.productName ?? "Produto não identificado"}</p>
                </div>

                {/* Impact badges */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${alert.opsAffectedCount > 0 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-white/5 text-white/30 border border-white/10"}`}>
                    <Factory className="h-3.5 w-3.5" />
                    {alert.opsAffectedCount} OP{alert.opsAffectedCount !== 1 ? "s" : ""}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${alert.clientsExposedCount > 0 ? "bg-red-500/20 text-red-300 border border-red-500/40" : "bg-white/5 text-white/30 border border-white/10"}`}>
                    <Users className="h-3.5 w-3.5" />
                    {alert.clientsExposedCount} cliente{alert.clientsExposedCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Detail rows */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                {alert.supplierLot && <DataRow label="Lote Forn." value={alert.supplierLot} />}
                {alert.totalQty !== null && alert.totalQty !== undefined && (
                  <DataRow label="Qtd Total" value={`${alert.totalQty} un`} />
                )}
                {alert.expirationDate && <DataRow label="Validade" value={fmt(alert.expirationDate)} />}
                {alert.manufacturingDate && <DataRow label="Fabricação" value={fmt(alert.manufacturingDate)} />}
              </div>

              {/* Affected OPs list */}
              {(alert.affectedOps as any[])?.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-white/40 mb-1.5">OPs que consumiram este lote:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(alert.affectedOps as any[]).map((op: any) => (
                      <Badge key={op.id} variant="outline" className="text-xs border-amber-500/30 text-amber-300">
                        <Factory className="h-3 w-3 mr-1" />
                        OP {op.number}
                        {op.batchLot ? ` → ${op.batchLot}` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Exposed clients list */}
              {(alert.exposedClients as any[])?.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-white/40 mb-1.5">Clientes que podem ter recebido PA derivado:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(alert.exposedClients as any[]).map((c: any, i: number) => (
                      <Badge key={c.soId ?? i} variant="outline" className="text-xs border-red-500/30 text-red-300">
                        <Users className="h-3 w-3 mr-1" />
                        {c.clientName ?? "Cliente desconhecido"}
                        {c.clientCity ? ` — ${c.clientCity}` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CombinedView({ lot }: { lot: string }) {
  const { data: trace, isLoading, error } = useGetTraceabilityTrace(
    { lot },
    { query: { enabled: !!lot } as any }
  );
  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-3 text-white/40">
      <Clock className="h-5 w-5 animate-spin" /><span>Carregando rastreabilidade completa…</span>
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-3 py-8 text-red-300 text-sm">
      <XCircle className="h-4 w-4" />Lote não encontrado.
    </div>
  );
  if (!trace) return null;

  const fw = trace.forward as any;
  const bw = trace.backward as any;
  const info = trace.mpLotInfo as any;

  const detectedLabel = trace.detectedAs === "mp" ? "Matéria-Prima"
    : trace.detectedAs === "pa" ? "Produto Acabado (Lote OP)"
    : trace.detectedAs === "both" ? "MP e PA"
    : "Tipo desconhecido";

  return (
    <div className="space-y-4">
      {/* Lot summary header */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="pt-4 pb-4 space-y-1.5">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 border text-xs">{detectedLabel}</Badge>
          </div>
          {info && (
            <>
              <DataRow label="Produto" value={info.productName} />
              <DataRow label="Lote Fornecedor" value={info.supplierLot} />
              <DataRow label="Qtd Total" value={info.totalQty !== undefined ? `${info.totalQty} un` : null} />
              <DataRow label="Status CQ" value={<CqBadge status={info.cqStatus} />} />
              <DataRow label="Fabricação" value={fmt(info.manufacturingDate)} />
              <DataRow label="Validade" value={fmt(info.expirationDate)} />
            </>
          )}
        </CardContent>
      </Card>

      {fw && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white/80">Direta (MP → PA → Clientes)</h3>
          </div>
          {(fw.paLots as any[])?.length > 0 && (
            <SectionToggle title="Lotes PA Gerados" icon={Package} iconColor="text-blue-400" count={fw.paLots.length}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fw.paLots.map((l: any) => (
                  <GridCard key={l.id}>
                    <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{l.internalLot}</span><CqBadge status={l.cqStatus} /></div>
                    <DataRow label="Produto" value={l.productName} />
                    <DataRow label="Validade" value={fmt(l.expirationDate)} />
                  </GridCard>
                ))}
              </div>
            </SectionToggle>
          )}
          {(fw.salesOrders as any[])?.length > 0 && (
            <SectionToggle title="Pedidos de Venda" icon={ShoppingCart} iconColor="text-sky-400" count={fw.salesOrders.length}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fw.salesOrders.map((so: any) => (
                  <GridCard key={so.id}>
                    <div className="flex items-center justify-between"><span className="font-medium text-sm text-white/90">{so.clientName ?? "—"}</span><StatusBadge status={so.status} /></div>
                    <DataRow label="Cidade" value={so.clientCity ? `${so.clientCity}/${so.clientState}` : null} />
                    <DataRow label="Total" value={so.totalAmount !== undefined ? `R$ ${Number(so.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
                  </GridCard>
                ))}
              </div>
            </SectionToggle>
          )}
          {!(fw.paLots as any[])?.length && !(fw.salesOrders as any[])?.length && (
            <p className="text-white/30 text-sm pl-2">Sem dados de rastreabilidade direta.</p>
          )}
        </div>
      )}

      {bw && (
        <div className="space-y-3">
          <Separator className="bg-white/10" />
          <div className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white/80">Reversa (PA → MP → Fornecedores)</h3>
          </div>
          {(bw.suppliers as any[])?.length > 0 && (
            <SectionToggle title="Fornecedores" icon={Truck} iconColor="text-purple-400" count={bw.suppliers.length}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bw.suppliers.map((s: any) => (
                  <GridCard key={s.id}>
                    <div className="font-medium text-sm text-white/90">{s.supplierName ?? "—"}</div>
                    <DataRow label="NF Entrada" value={s.nfNumber} />
                    <DataRow label="Recebimento" value={fmt(s.receivedAt)} />
                  </GridCard>
                ))}
              </div>
            </SectionToggle>
          )}
          {(bw.ncrs as any[])?.length > 0 && (
            <SectionToggle title="NCRs" icon={AlertTriangle} iconColor="text-red-400" count={bw.ncrs.length}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bw.ncrs.map((n: any) => (
                  <GridCard key={n.id}>
                    <div className="font-medium text-sm text-white/90">{n.title}</div>
                    <DataRow label="Severidade" value={n.severity} />
                    <DataRow label="Status" value={<StatusBadge status={n.status} />} />
                  </GridCard>
                ))}
              </div>
            </SectionToggle>
          )}
          {!(bw.suppliers as any[])?.length && !(bw.ncrs as any[])?.length && (
            <p className="text-white/30 text-sm pl-2">Sem dados de rastreabilidade reversa.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RastreabilidadePage() {
  const [inputValue, setInputValue] = useState("");
  const [activeLot, setActiveLot] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mainTab, setMainTab] = useState<"trace" | "alerts">("trace");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: suggestions = [] } = useSearchTraceLots(
    { q: inputValue },
    { query: { enabled: inputValue.length >= 2 } as any }
  );

  const handleSearch = useCallback(() => {
    const v = inputValue.trim();
    if (v) { setActiveLot(v); setShowSuggestions(false); }
  }, [inputValue]);

  const handleSelect = useCallback((lot: string, label: string) => {
    setInputValue(lot);
    setActiveLot(lot);
    setShowSuggestions(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") setShowSuggestions(false);
  }, [handleSearch]);

  const handlePrint = () => {
    window.print();
  };

  const printTimestamp = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <>
      <style>{`
        @media print {
          nav, aside, header, .sidebar, .no-print, [data-sidebar], [data-radix-popper-content-wrapper] { display: none !important; }
          .print-root { padding: 16px !important; background: white !important; }
          .print-report-header { display: block !important; }
          * { color: #111 !important; background: white !important; border-color: #ddd !important; }
          .print-card { border: 1px solid #ccc !important; border-radius: 4px !important; }
          @page { margin: 1.5cm; }
        }
        .print-report-header { display: none; }
      `}</style>

      <div className="p-6 space-y-6 max-w-5xl mx-auto print-root">
        {/* Print-only report header */}
        <div className="print-report-header border-b-2 pb-4 mb-6">
          <h1 className="text-2xl font-bold">
            {mainTab === "alerts" ? "Relatório de Alertas de Rastreabilidade" : "Relatório de Rastreabilidade"}
          </h1>
          {mainTab === "trace" && activeLot && (
            <p className="text-sm">Lote: <strong>{activeLot}</strong> — Gerado em: {printTimestamp}</p>
          )}
          {mainTab === "alerts" && (
            <p className="text-sm">Painel de lotes críticos (reprovados/quarentena) — Gerado em: {printTimestamp}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">NEXUS ERP — Documento para fins de auditoria e recall</p>
        </div>

        {/* Screen header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <GitBranch className="h-7 w-7 text-violet-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Rastreabilidade</h1>
              <p className="text-sm text-white/50">Rastreamento completo de lotes — frente e verso</p>
            </div>
          </div>
          {((mainTab === "trace" && activeLot) || mainTab === "alerts") && (
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2 border-white/20 text-white/70 hover:text-white no-print">
              <Printer className="h-4 w-4" />
              Exportar PDF
            </Button>
          )}
        </div>

        {/* Main tabs: Rastrear vs Alertas */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "trace" | "alerts")} className="w-full">
          <TabsList className="bg-white/5 border border-white/10 no-print">
            <TabsTrigger value="trace" className="gap-1.5 text-white/70 data-[state=active]:text-white data-[state=active]:bg-violet-600/40">
              <Search className="h-3.5 w-3.5" />
              Rastrear Lote
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5 text-white/70 data-[state=active]:text-white data-[state=active]:bg-red-600/40">
              <Bell className="h-3.5 w-3.5" />
              Alertas de Recall
            </TabsTrigger>
          </TabsList>

          {/* ── Trace tab ─────────────────────────────────────────── */}
          <TabsContent value="trace" className="mt-4 space-y-5">
            {/* Search */}
            <Card className="bg-white/5 border-white/10 no-print">
              <CardContent className="pt-5 pb-5">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={e => { setInputValue(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite o número do lote e pressione Enter…"
                      className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/30 h-11"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-white/20 bg-gray-900 shadow-xl overflow-hidden">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onMouseDown={() => handleSelect(s.lot, s.label)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-medium text-white">{s.lot}</p>
                              <p className="text-xs text-white/50">{s.label}</p>
                            </div>
                            <CqBadge status={s.cqStatus} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleSearch} disabled={!inputValue.trim()} className="h-11 px-5 bg-violet-600 hover:bg-violet-500 text-white">
                    <Search className="h-4 w-4 mr-2" />Rastrear
                  </Button>
                </div>
                <p className="mt-2 text-xs text-white/30">
                  Pesquise por lote interno, lote de fornecedor ou lote de OP. Selecione da lista ou pressione Enter para busca direta.
                </p>
              </CardContent>
            </Card>

            {/* Results */}
            {activeLot && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <GitBranch className="h-5 w-5 text-violet-400" />
                  <CardTitle className="text-white text-lg font-bold">Lote: {activeLot}</CardTitle>
                </div>

                <Tabs defaultValue="combined" className="w-full">
                  <TabsList className="bg-white/5 border border-white/10 no-print">
                    <TabsTrigger value="combined" className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-violet-600/40">
                      Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="forward" className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-emerald-600/40">
                      <ArrowRight className="h-3.5 w-3.5 mr-1" />Direta (MP→Clientes)
                    </TabsTrigger>
                    <TabsTrigger value="backward" className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-orange-600/40">
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />Reversa (PA→Fornec.)
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="combined" className="mt-4">
                    <CombinedView lot={activeLot} />
                  </TabsContent>
                  <TabsContent value="forward" className="mt-4">
                    <ForwardView lot={activeLot} />
                  </TabsContent>
                  <TabsContent value="backward" className="mt-4">
                    <BackwardView lot={activeLot} />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Empty state */}
            {!activeLot && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center no-print">
                <GitBranch className="h-12 w-12 text-white/20" />
                <p className="text-white/40 text-sm max-w-sm">
                  Digite um número de lote e clique em <strong className="text-white/60">Rastrear</strong> ou pressione <kbd className="px-1.5 py-0.5 rounded border border-white/20 text-xs">Enter</kbd> para visualizar a cadeia completa de rastreabilidade.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Alerts tab ─────────────────────────────────────────── */}
          <TabsContent value="alerts" className="mt-4">
            <AlertsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
