import { CheckCircle2, Clock, XCircle, AlertTriangle, Loader2, Ban, RotateCcw, Send, Truck, Package, CircleDot, ShieldAlert, ShieldCheck, UserCheck, UserX, Timer, ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusVariant = "green" | "red" | "amber" | "blue" | "gray" | "purple" | "orange";

interface StatusConfig {
  label: string;
  variant: StatusVariant;
  icon?: React.ElementType;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  /* Generic positive */
  active:       { label: "Ativo",          variant: "green",  icon: CheckCircle2 },
  approved:     { label: "Aprovado",       variant: "green",  icon: CheckCircle2 },
  paid:         { label: "Pago",           variant: "green",  icon: CheckCircle2 },
  completed:    { label: "Concluído",      variant: "green",  icon: CheckCircle2 },
  done:         { label: "Concluído",      variant: "green",  icon: CheckCircle2 },
  delivered:    { label: "Entregue",       variant: "green",  icon: CheckCircle2 },
  released:     { label: "Liberado",       variant: "green",  icon: CheckCircle2 },
  confirmed:    { label: "Confirmado",     variant: "green",  icon: CheckCircle2 },
  resolved:     { label: "Resolvida",      variant: "green",  icon: ShieldCheck },
  received:     { label: "Recebido",       variant: "green",  icon: Package },
  issued:       { label: "Emitida",        variant: "green",  icon: CheckCircle2 },
  present:      { label: "Presente",       variant: "green",  icon: UserCheck },
  /* In-progress / blue */
  in_progress:  { label: "Em andamento",   variant: "blue",   icon: Loader2 },
  in_production:{ label: "Em produção",    variant: "blue",   icon: Loader2 },
  processing:   { label: "Processando",    variant: "blue",   icon: Loader2 },
  shipped:      { label: "Enviado",        variant: "blue",   icon: Truck },
  sent:         { label: "Enviado",        variant: "blue",   icon: Send },
  ordered:      { label: "Pedido",         variant: "blue",   icon: CircleDot },
  input:        { label: "Entrada",        variant: "blue",   icon: ArrowDown },
  /* Warning / amber */
  pending:      { label: "Pendente",       variant: "amber",  icon: Clock },
  waiting:      { label: "Aguardando",     variant: "amber",  icon: Clock },
  quarantine:   { label: "Quarentena",     variant: "amber",  icon: AlertTriangle },
  overdue:      { label: "Vencido",        variant: "amber",  icon: AlertTriangle },
  open:         { label: "Aberta",         variant: "amber",  icon: AlertTriangle },
  conditional:  { label: "Condicional",    variant: "amber",  icon: AlertTriangle },
  on_hold:      { label: "Em espera",      variant: "amber",  icon: Clock },
  late:         { label: "Atrasado",       variant: "amber",  icon: Timer },
  /* Severity */
  low:          { label: "Baixa",          variant: "blue",   icon: ShieldAlert },
  medium:       { label: "Média",          variant: "amber",  icon: ShieldAlert },
  high:         { label: "Alta",           variant: "orange", icon: ShieldAlert },
  critical:     { label: "Crítica",        variant: "red",    icon: ShieldAlert },
  /* Vendas pipeline */
  awaiting_docs:     { label: "Aguardando Docs",      variant: "amber",  icon: Clock },
  credit_check:      { label: "Análise de Crédito",   variant: "blue",   icon: Loader2 },
  credit_rejected:   { label: "Crédito Reprovado",    variant: "red",    icon: XCircle },
  regulatory_check:  { label: "Análise Regulatória",  variant: "blue",   icon: Loader2 },
  raw_material_check:{ label: "Verificação MP",        variant: "amber",  icon: Clock },
  production_planned:{ label: "Prod. Planejada",       variant: "gray",   icon: CircleDot },
  quality_rejected:  { label: "CQ Reprovado",          variant: "red",    icon: XCircle },
  quality_approved:  { label: "CQ Aprovado",           variant: "green",  icon: CheckCircle2 },
  invoice_issued:    { label: "NF Emitida",            variant: "green",  icon: CheckCircle2 },
  awaiting_pickup:   { label: "Aguardando Coleta",     variant: "amber",  icon: Clock },
  /* Neutral / gray */
  draft:        { label: "Rascunho",       variant: "gray",   icon: CircleDot },
  todo:         { label: "A fazer",        variant: "gray",   icon: CircleDot },
  quote:        { label: "Orçamento",      variant: "gray",   icon: CircleDot },
  inactive:     { label: "Inativo",        variant: "gray" },
  closed:       { label: "Fechada",        variant: "gray" },
  planning:     { label: "Planejamento",   variant: "gray",   icon: CircleDot },
  /* Negative / red */
  cancelled:    { label: "Cancelado",      variant: "red",    icon: Ban },
  canceled:     { label: "Cancelado",      variant: "red",    icon: Ban },
  rejected:     { label: "Reprovado",      variant: "red",    icon: XCircle },
  blocked:      { label: "Bloqueado",      variant: "red",    icon: Ban },
  failed:       { label: "Falhou",         variant: "red",    icon: XCircle },
  absent:       { label: "Ausente",        variant: "red",    icon: UserX },
  out:          { label: "Zerado",         variant: "red",    icon: AlertTriangle },
  output:       { label: "Saída",          variant: "red",    icon: ArrowUp },
  /* Purple */
  returned:     { label: "Devolvido",      variant: "purple", icon: RotateCcw },
  rework:       { label: "Retrabalho",     variant: "purple", icon: RotateCcw },
};

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  green:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  red:    "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  amber:  "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  blue:   "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  gray:   "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, label, className, showIcon = true }: StatusBadgeProps) {
  const config = STATUS_MAP[status.toLowerCase()] ?? {
    label: label ?? status,
    variant: "gray" as StatusVariant,
  };
  const displayLabel = label ?? config.label;
  const Icon = showIcon ? config.icon : undefined;
  const variantClass = VARIANT_CLASSES[config.variant];

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap", variantClass, className)}>
      {Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
      {displayLabel}
    </span>
  );
}

export function getStatusVariant(status: string): StatusVariant {
  return STATUS_MAP[status.toLowerCase()]?.variant ?? "gray";
}
