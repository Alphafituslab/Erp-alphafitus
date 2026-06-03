import { useState, useCallback, useRef } from "react";
import { useSearchTraceLots, useGetTraceabilityTrace } from "@workspace/api-client-react";
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
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(d?: string | Date | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return "—"; }
}

function CqBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline" className="text-xs">Sem status CQ</Badge>;
  const map: Record<string, { label: string; className: string }> = {
    approved: { label: "Aprovado", className: "bg-green-500/20 text-green-300 border-green-500/40" },
    rejected: { label: "Reprovado", className: "bg-red-500/20 text-red-300 border-red-500/40" },
    pending:  { label: "Pendente",  className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
    quarantine: { label: "Quarentena", className: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-300 border-gray-500/40" };
  return <Badge className={`text-xs border ${cfg.className}`}>{cfg.label}</Badge>;
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const statusMap: Record<string, string> = {
    draft: "Rascunho", confirmed: "Confirmado", in_progress: "Em andamento",
    completed: "Concluído", cancelled: "Cancelado", approved: "Aprovado",
    rejected: "Reprovado", pending: "Pendente", released: "Liberado",
  };
  return <Badge variant="outline" className="text-xs">{statusMap[status] ?? status}</Badge>;
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
  if (value === null || value === undefined) return null;
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

export default function RastreabilidadePage() {
  const [query, setQuery] = useState("");
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: suggestions = [] } = useSearchTraceLots(
    { q: query },
    { query: { enabled: query.length >= 2 } as any }
  );

  const { data: trace, isLoading: traceLoading, error: traceError } = useGetTraceabilityTrace(
    { lot: selectedLot! },
    { query: { enabled: !!selectedLot } as any }
  );

  const handleSelect = useCallback((lot: string) => {
    setSelectedLot(lot);
    setQuery(lot);
    setShowSuggestions(false);
  }, []);

  const handlePrint = () => window.print();

  const detectedLabel = trace?.detectedAs === "mp" ? "Matéria-Prima / Lote de Produto"
    : trace?.detectedAs === "pa" ? "Produto Acabado (Lote OP)"
    : trace?.detectedAs === "both" ? "MP e PA"
    : "Desconhecido";

  const fw = trace?.forward as any;
  const bw = trace?.backward as any;

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          nav, aside, header, footer, .sidebar, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-root { padding: 0 !important; }
          .print-card { border: 1px solid #ccc !important; background: white !important; }
          * { color: black !important; border-color: #ccc !important; }
        }
      `}</style>

      <div className="p-6 space-y-6 max-w-5xl mx-auto print-root">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <GitBranch className="h-7 w-7 text-violet-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Rastreabilidade</h1>
              <p className="text-sm text-white/50">Rastreamento completo de lotes — frente e verso</p>
            </div>
          </div>
          {trace && (
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2 border-white/20 text-white/70 hover:text-white">
              <Printer className="h-4 w-4" />
              Exportar PDF
            </Button>
          )}
        </div>

        {/* Search */}
        <Card className="bg-white/5 border-white/10 no-print">
          <CardContent className="pt-5 pb-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setShowSuggestions(true); setSelectedLot(null); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Digite o número do lote (mínimo 2 caracteres)…"
                className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/30 h-11"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/20 bg-gray-900 shadow-xl overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSelect(s.lot)}
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
            {!selectedLot && query.length < 2 && (
              <p className="mt-2 text-xs text-white/30">
                Pesquise por lote interno, lote do fornecedor ou lote de OP de produção.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Loading */}
        {traceLoading && (
          <div className="flex items-center justify-center py-16 gap-3 text-white/50">
            <Clock className="h-5 w-5 animate-spin" />
            <span>Carregando rastreabilidade…</span>
          </div>
        )}

        {/* Error */}
        {traceError && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="pt-5 pb-5 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-400" />
              <p className="text-red-300 text-sm">Lote não encontrado. Verifique o número e tente novamente.</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {trace && !traceLoading && (
          <div className="space-y-6 print-card">
            {/* Lot header */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <GitBranch className="h-5 w-5 text-violet-400" />
                  <CardTitle className="text-white text-lg font-bold">{trace.lotNumber}</CardTitle>
                  <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 border text-xs">{detectedLabel}</Badge>
                </div>
              </CardHeader>
              {trace.mpLotInfo && (
                <CardContent className="pt-0 space-y-1.5">
                  <DataRow label="Produto" value={(trace.mpLotInfo as any)?.productName} />
                  <DataRow label="Lote Fornecedor" value={(trace.mpLotInfo as any)?.supplierLot} />
                  <DataRow label="Qtd Total" value={(trace.mpLotInfo as any)?.totalQty !== undefined ? `${(trace.mpLotInfo as any).totalQty} un` : null} />
                  <DataRow label="Status CQ" value={<CqBadge status={(trace.mpLotInfo as any)?.cqStatus} />} />
                  <DataRow label="Fabricação" value={fmt((trace.mpLotInfo as any)?.manufacturingDate)} />
                  <DataRow label="Validade" value={fmt((trace.mpLotInfo as any)?.expirationDate)} />
                </CardContent>
              )}
            </Card>

            {/* FORWARD trace */}
            {fw && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-base font-semibold text-white">Rastreabilidade Direta <span className="text-white/40 font-normal text-sm">(MP → PA → Clientes)</span></h2>
                </div>

                {fw.cqAnalyses?.length > 0 && (
                  <SectionToggle title="Análises CQ" icon={FlaskConical} iconColor="text-teal-400" count={fw.cqAnalyses.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fw.cqAnalyses.map((a: any) => (
                        <GridCard key={a.id}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-white/80">{a.sampleCode}</span>
                            <StatusBadge status={a.status} />
                          </div>
                          <DataRow label="Tipo" value={a.analysisType} />
                          <DataRow label="Analista" value={a.analystName} />
                          <DataRow label="Concluído" value={fmt(a.completedAt)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {fw.cqCertificates?.length > 0 && (
                  <SectionToggle title="Certificados de Qualidade" icon={CheckCircle2} iconColor="text-green-400" count={fw.cqCertificates.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fw.cqCertificates.map((c: any) => (
                        <GridCard key={c.id}>
                          <div className="font-medium text-sm text-white/90">{c.certificateNumber ?? `Cert #${c.id}`}</div>
                          <DataRow label="Emitido" value={fmt(c.issuedAt)} />
                          <DataRow label="Válido até" value={fmt(c.validUntil)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {fw.consumptions?.length > 0 && (
                  <SectionToggle title="Consumos em OPs" icon={Factory} iconColor="text-rose-400" count={fw.consumptions.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fw.consumptions.map((c: any) => (
                        <GridCard key={c.id}>
                          <div className="font-medium text-sm text-white/90">{c.productName}</div>
                          <DataRow label="Qtd Real" value={c.actualQty !== undefined ? `${c.actualQty} ${c.unit ?? ""}` : null} />
                          <DataRow label="Registrado por" value={c.recordedBy} />
                          <DataRow label="Data" value={fmt(c.recordedAt)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {fw.productionOrders?.length > 0 && (
                  <SectionToggle title="Ordens de Produção" icon={Factory} iconColor="text-amber-400" count={fw.productionOrders.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fw.productionOrders.map((op: any) => (
                        <GridCard key={op.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">OP {op.number}</span>
                            <StatusBadge status={op.status} />
                          </div>
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

                {fw.paLots?.length > 0 && (
                  <SectionToggle title="Lotes de Produto Acabado" icon={Package} iconColor="text-blue-400" count={fw.paLots.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fw.paLots.map((l: any) => (
                        <GridCard key={l.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">{l.internalLot}</span>
                            <CqBadge status={l.cqStatus} />
                          </div>
                          <DataRow label="Produto" value={l.productName} />
                          <DataRow label="Qtd Total" value={l.totalQty !== undefined ? `${l.totalQty} un` : null} />
                          <DataRow label="Validade" value={fmt(l.expirationDate)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {fw.salesOrders?.length > 0 && (
                  <SectionToggle title="Pedidos de Venda" icon={ShoppingCart} iconColor="text-sky-400" count={fw.salesOrders.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fw.salesOrders.map((so: any) => (
                        <GridCard key={so.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">{so.clientName ?? "Cliente não identificado"}</span>
                            <StatusBadge status={so.status} />
                          </div>
                          <DataRow label="Documento" value={so.clientDocument} />
                          <DataRow label="Cidade" value={so.clientCity ? `${so.clientCity}/${so.clientState}` : null} />
                          <DataRow label="Total" value={so.totalAmount !== undefined ? `R$ ${Number(so.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
                          <DataRow label="Entrega" value={fmt(so.deliveryDate)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {fw.fiscalDocs?.length > 0 && (
                  <SectionToggle title="Documentos Fiscais" icon={FileText} iconColor="text-purple-400" count={fw.fiscalDocs.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fw.fiscalDocs.map((d: any) => (
                        <GridCard key={d.id}>
                          <div className="font-medium text-sm text-white/90">{d.documentType?.toUpperCase()} {d.number ? `nº ${d.number}` : `#${d.id}`}</div>
                          <DataRow label="Chave" value={d.accessKey ? `${d.accessKey.slice(0, 20)}…` : null} />
                          <DataRow label="Status" value={<StatusBadge status={d.status} />} />
                          <DataRow label="Emissão" value={fmt(d.issueDate)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {(!fw.consumptions?.length && !fw.productionOrders?.length && !fw.paLots?.length && !fw.salesOrders?.length) && (
                  <div className="text-center py-6 text-white/30 text-sm border border-white/10 rounded-lg">
                    Nenhum dado de rastreabilidade direta encontrado para este lote.
                  </div>
                )}
              </div>
            )}

            {/* BACKWARD trace */}
            {bw && (
              <div className="space-y-4">
                <Separator className="bg-white/10 my-4" />
                <div className="flex items-center gap-2">
                  <ArrowLeft className="h-5 w-5 text-orange-400" />
                  <h2 className="text-base font-semibold text-white">Rastreabilidade Reversa <span className="text-white/40 font-normal text-sm">(PA → MP → Fornecedores)</span></h2>
                </div>

                {bw.productionOrders?.length > 0 && (
                  <SectionToggle title="Ordens de Produção (Origem)" icon={Factory} iconColor="text-rose-400" count={bw.productionOrders.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bw.productionOrders.map((op: any) => (
                        <GridCard key={op.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">OP {op.number}</span>
                            <StatusBadge status={op.status} />
                          </div>
                          <DataRow label="Produto" value={op.productName} />
                          <DataRow label="Lote PA" value={op.batchLot} />
                          <DataRow label="Qtd Real" value={op.actualQty !== undefined ? `${op.actualQty} ${op.unit ?? ""}` : null} />
                          <DataRow label="Início real" value={fmt(op.actualStart)} />
                          <DataRow label="Fim real" value={fmt(op.actualEnd)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {bw.consumedMpLots?.length > 0 && (
                  <SectionToggle title="Matérias-Primas Consumidas" icon={Package} iconColor="text-amber-400" count={bw.consumedMpLots.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bw.consumedMpLots.map((c: any, i: number) => (
                        <GridCard key={c.id ?? i}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">{c.productName}</span>
                            <CqBadge status={c.cqStatus} />
                          </div>
                          <DataRow label="Lote Interno" value={c.internalLot} />
                          <DataRow label="Lote Fornecedor" value={c.supplierLot} />
                          <DataRow label="Qtd Real" value={c.actualQty !== undefined ? `${c.actualQty} ${c.unit ?? ""}` : null} />
                          <DataRow label="Data" value={fmt(c.recordedAt)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {bw.mpLots?.length > 0 && (
                  <SectionToggle title="Lotes de MP (Detalhes)" icon={Package} iconColor="text-blue-400" count={bw.mpLots.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bw.mpLots.map((l: any) => (
                        <GridCard key={l.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">{l.internalLot}</span>
                            <CqBadge status={l.cqStatus} />
                          </div>
                          <DataRow label="Produto" value={l.productName} />
                          <DataRow label="Lote Forn." value={l.supplierLot} />
                          <DataRow label="Qtd Total" value={l.totalQty !== undefined ? `${l.totalQty} un` : null} />
                          <DataRow label="Validade" value={fmt(l.expirationDate)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {bw.suppliers?.length > 0 && (
                  <SectionToggle title="Fornecedores" icon={Truck} iconColor="text-purple-400" count={bw.suppliers.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bw.suppliers.map((s: any) => (
                        <GridCard key={s.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">{s.supplierName ?? "Fornecedor"}</span>
                            <Badge variant="outline" className="text-xs">{s.supplierApprovalStatus ?? "—"}</Badge>
                          </div>
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

                {bw.qualityAnalyses?.length > 0 && (
                  <SectionToggle title="Análises CQ das MPs" icon={FlaskConical} iconColor="text-teal-400" count={bw.qualityAnalyses.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bw.qualityAnalyses.map((a: any) => (
                        <GridCard key={a.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">{a.sampleCode}</span>
                            <StatusBadge status={a.status} />
                          </div>
                          <DataRow label="Lote" value={a.internalLot} />
                          <DataRow label="Tipo" value={a.analysisType} />
                          <DataRow label="Analista" value={a.analystName} />
                          <DataRow label="Concluído" value={fmt(a.completedAt)} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {bw.ncrs?.length > 0 && (
                  <SectionToggle title="Não Conformidades (NCRs)" icon={AlertTriangle} iconColor="text-red-400" count={bw.ncrs.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bw.ncrs.map((n: any) => (
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

                {bw.salesOrders?.length > 0 && (
                  <SectionToggle title="Pedidos de Venda Associados" icon={ShoppingCart} iconColor="text-sky-400" count={bw.salesOrders.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bw.salesOrders.map((so: any) => (
                        <GridCard key={so.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90">{so.clientName ?? "Cliente"}</span>
                            <StatusBadge status={so.status} />
                          </div>
                          <DataRow label="Documento" value={so.clientDocument} />
                          <DataRow label="Cidade" value={so.clientCity} />
                          <DataRow label="Total" value={so.totalAmount !== undefined ? `R$ ${Number(so.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
                        </GridCard>
                      ))}
                    </div>
                  </SectionToggle>
                )}

                {(!bw.consumedMpLots?.length && !bw.mpLots?.length && !bw.suppliers?.length) && (
                  <div className="text-center py-6 text-white/30 text-sm border border-white/10 rounded-lg">
                    Nenhum dado de rastreabilidade reversa encontrado para este lote.
                  </div>
                )}
              </div>
            )}

            {/* No trace sections at all */}
            {!fw && !bw && (
              <div className="text-center py-10 text-white/30 text-sm">
                Nenhuma rastreabilidade disponível para este lote.
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!selectedLot && !traceLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <GitBranch className="h-12 w-12 text-white/20" />
            <p className="text-white/40 text-sm max-w-sm">
              Digite um número de lote acima para visualizar toda a cadeia de rastreabilidade — da matéria-prima ao cliente final e vice-versa.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
