import { useState, useRef, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import {
  useListWorkCenters,
  useCreateWorkCenter,
  useUpdateWorkCenter,
  useDeleteWorkCenter,
  useListApsSchedule,
  useCreateApsScheduleEntry,
  useUpdateApsScheduleEntry,
  useDeleteApsScheduleEntry,
  useGetApsDashboard,
  useGetApsAlerts,
  useAutoScheduleAps,
  useSimulateAps,
  useListProductionShifts,
  useCreateProductionShift,
  useUpdateProductionShift,
  useDeleteProductionShift,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListWorkCentersQueryKey,
  getListApsScheduleQueryKey,
  getGetApsDashboardQueryKey,
  getGetApsAlertsQueryKey,
  getListProductionShiftsQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Factory,
  PlayCircle,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  TrendingUp,
  XCircle,
  Zap,
  CalendarClock,
  AlertCircle,
  Wand2,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Shift {
  id: number;
  workCenterId: number;
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  availableHours: string;
  isBlocked: boolean;
  blockReason?: string | null;
}

interface WorkCenter {
  id: number;
  name: string;
  description?: string | null;
  type: "machine" | "work_center" | "line";
  capacityHoursPerShift: string;
  setupTimeMinutes: number;
  isActive: boolean;
  notes?: string | null;
}

interface ScheduleEntry {
  id: number;
  productionOrderId?: number | null;
  workCenterId: number;
  workCenterName?: string | null;
  orderNumber?: string | null;
  productName?: string | null;
  plannedQty?: string | null;
  unit: string;
  scheduledStart: string;
  scheduledEnd: string;
  estimatedHours?: string | null;
  status: "planned" | "in_progress" | "done" | "delayed" | "cancelled";
  priority: number;
  sequenceNumber?: number | null;
  notes?: string | null;
  rescheduledAt?: string | null;
  rescheduledBy?: string | null;
  rescheduledReason?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  planned: { label: "Planejado", color: "text-blue-700", bg: "bg-blue-500", border: "border-blue-600" },
  in_progress: { label: "Em Produção", color: "text-yellow-700", bg: "bg-yellow-500", border: "border-yellow-600" },
  done: { label: "Concluído", color: "text-green-700", bg: "bg-green-500", border: "border-green-600" },
  delayed: { label: "Atrasado", color: "text-red-700", bg: "bg-red-500", border: "border-red-600" },
  cancelled: { label: "Cancelado", color: "text-gray-500", bg: "bg-gray-400", border: "border-gray-500" },
};

const SEVERITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  critical: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  high: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  medium: { icon: AlertCircle, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
  low: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
};

function formatDT(dt: string) {
  if (!dt) return "";
  return dt.replace("T", " ").slice(0, 16);
}

function formatDate(dt: string) {
  if (!dt) return "";
  return dt.slice(0, 10);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Gantt Chart ──────────────────────────────────────────────────────────────

const GANTT_ROW_H = 52;
const GANTT_LABEL_W = 180;
const GANTT_DAY_W = 96;

interface GanttProps {
  workCenters: WorkCenter[];
  entries: ScheduleEntry[];
  startDate: string;
  days: number;
  onEntryClick: (e: ScheduleEntry) => void;
  onEntryDrop: (entryId: number, newWorkCenterId: number, newDate: string) => void;
}

function GanttChart({ workCenters, entries, startDate, days, onEntryClick, onEntryDrop }: GanttProps) {
  const [tooltip, setTooltip] = useState<{ entry: ScheduleEntry; x: number; y: number } | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const start = new Date(startDate + "T00:00:00");
  const totalMs = days * 86400000;

  const pxFromDate = (dt: string) => {
    const d = new Date(dt.length === 10 ? dt + "T00:00:00" : dt);
    const pct = Math.max(0, (d.getTime() - start.getTime()) / totalMs);
    return GANTT_LABEL_W + pct * (days * GANTT_DAY_W);
  };

  const widthFromDates = (s: string, e: string) => {
    const sd = new Date(s.length === 10 ? s + "T00:00:00" : s);
    const ed = new Date(e.length === 10 ? e + "T00:00:00" : e);
    const dur = ed.getTime() - sd.getTime();
    const maxW = days * GANTT_DAY_W;
    const w = (dur / totalMs) * maxW;
    return Math.max(8, Math.min(w, maxW));
  };

  const rowForWc = (wcId: number) => workCenters.findIndex(wc => wc.id === wcId);

  const handleDragOver = (e: React.DragEvent, wcIdx: number, dayIdx: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, wcIdx: number, dayIdx: number) => {
    e.preventDefault();
    if (dragId === null) return;
    const wc = workCenters[wcIdx];
    if (!wc) return;
    const newDate = addDays(startDate, dayIdx);
    onEntryDrop(dragId, wc.id, newDate);
    setDragId(null);
  };

  const dayLabels: string[] = [];
  for (let i = 0; i < days; i++) {
    dayLabels.push(addDays(startDate, i));
  }

  const totalWidth = GANTT_LABEL_W + days * GANTT_DAY_W;
  const totalHeight = GANTT_ROW_H * workCenters.length + 32;

  return (
    <div className="relative overflow-auto border rounded-lg bg-background" ref={chartRef}>
      <div style={{ width: totalWidth, minHeight: totalHeight + 32 }}>
        {/* Header row */}
        <div className="flex sticky top-0 z-10 bg-muted border-b">
          <div className="flex items-center px-3 font-medium text-sm text-muted-foreground border-r" style={{ width: GANTT_LABEL_W, minWidth: GANTT_LABEL_W, height: 32 }}>
            Centro de Trabalho
          </div>
          {dayLabels.map((d) => {
            const date = new Date(d + "T12:00:00");
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = d === todayStr();
            return (
              <div
                key={d}
                style={{ width: GANTT_DAY_W, minWidth: GANTT_DAY_W, height: 32 }}
                className={cn(
                  "text-center text-xs border-r flex flex-col items-center justify-center leading-tight",
                  isWeekend ? "bg-muted/80 text-muted-foreground" : "text-foreground",
                  isToday && "bg-primary/10 font-bold text-primary"
                )}
              >
                <span>{date.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
                <span>{date.getDate()}/{date.getMonth() + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {workCenters.map((wc, wcIdx) => (
          <div key={wc.id} className="flex border-b hover:bg-muted/20" style={{ height: GANTT_ROW_H }}>
            {/* Work center label */}
            <div
              className="flex items-center px-3 border-r bg-background/80 sticky left-0 z-10"
              style={{ width: GANTT_LABEL_W, minWidth: GANTT_LABEL_W }}
            >
              <div>
                <p className="text-sm font-medium truncate">{wc.name}</p>
                <p className="text-xs text-muted-foreground">{wc.capacityHoursPerShift}h/turno</p>
              </div>
            </div>

            {/* Day cells (drop targets) */}
            {dayLabels.map((d, dayIdx) => {
              const date = new Date(d + "T12:00:00");
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isToday = d === todayStr();
              return (
                <div
                  key={d}
                  style={{ width: GANTT_DAY_W, minWidth: GANTT_DAY_W }}
                  className={cn(
                    "border-r relative",
                    isWeekend && "bg-muted/40",
                    isToday && "bg-primary/5"
                  )}
                  onDragOver={(e) => handleDragOver(e, wcIdx, dayIdx)}
                  onDrop={(e) => handleDrop(e, wcIdx, dayIdx)}
                />
              );
            })}
          </div>
        ))}

        {/* Bars overlay */}
        <div className="absolute top-8 left-0 pointer-events-none" style={{ width: totalWidth, height: GANTT_ROW_H * workCenters.length }}>
          {entries.map((entry) => {
            const rowIdx = rowForWc(entry.workCenterId);
            if (rowIdx < 0) return null;
            const x = pxFromDate(entry.scheduledStart);
            const w = widthFromDates(entry.scheduledStart, entry.scheduledEnd);
            const y = rowIdx * GANTT_ROW_H + 6;
            const cfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.planned;
            const isDragging = dragId === entry.id;

            return (
              <div
                key={entry.id}
                className={cn(
                  "absolute pointer-events-auto rounded cursor-grab active:cursor-grabbing select-none border",
                  cfg.bg, cfg.border,
                  "text-white text-xs flex items-center px-2 gap-1 overflow-hidden transition-opacity",
                  isDragging && "opacity-40"
                )}
                style={{ left: x, top: y, width: w, height: GANTT_ROW_H - 12 }}
                draggable
                onDragStart={() => setDragId(entry.id)}
                onDragEnd={() => setDragId(null)}
                onClick={() => { setTooltip(null); onEntryClick(entry); }}
                onMouseEnter={(e) => {
                  const rect = (e.target as HTMLElement).closest(".relative")?.getBoundingClientRect();
                  setTooltip({ entry, x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {w > 40 && <span className="truncate font-medium">{entry.orderNumber ?? entry.productName ?? `#${entry.id}`}</span>}
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-popover border rounded-lg shadow-xl p-3 text-sm pointer-events-none min-w-[200px]"
            style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
          >
            <p className="font-semibold">{tooltip.entry.orderNumber ?? "Sem OP"}</p>
            {tooltip.entry.productName && <p className="text-muted-foreground">{tooltip.entry.productName}</p>}
            <p className="mt-1">Início: {formatDT(tooltip.entry.scheduledStart)}</p>
            <p>Fim: {formatDT(tooltip.entry.scheduledEnd)}</p>
            {tooltip.entry.plannedQty && <p>Qtd: {tooltip.entry.plannedQty} {tooltip.entry.unit}</p>}
            <Badge className={cn("mt-1 text-white", STATUS_CONFIG[tooltip.entry.status]?.bg)} variant="outline">
              {STATUS_CONFIG[tooltip.entry.status]?.label}
            </Badge>
            {tooltip.entry.rescheduledReason && (
              <p className="text-xs text-muted-foreground mt-1">Reprogramado: {tooltip.entry.rescheduledReason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Work Center Form Dialog ──────────────────────────────────────────────────

function WorkCenterDialog({ open, onClose, wc }: { open: boolean; onClose: () => void; wc?: WorkCenter | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const createMut = useCreateWorkCenter();
  const updateMut = useUpdateWorkCenter();

  const [form, setForm] = useState({
    name: wc?.name ?? "",
    description: wc?.description ?? "",
    type: wc?.type ?? "machine",
    capacityHoursPerShift: wc?.capacityHoursPerShift ?? "8",
    setupTimeMinutes: wc?.setupTimeMinutes?.toString() ?? "30",
    notes: wc?.notes ?? "",
    isActive: wc?.isActive ?? true,
  });

  useEffect(() => {
    if (wc) {
      setForm({
        name: wc.name,
        description: wc.description ?? "",
        type: wc.type,
        capacityHoursPerShift: wc.capacityHoursPerShift,
        setupTimeMinutes: wc.setupTimeMinutes.toString(),
        notes: wc.notes ?? "",
        isActive: wc.isActive,
      });
    } else {
      setForm({ name: "", description: "", type: "machine", capacityHoursPerShift: "8", setupTimeMinutes: "30", notes: "", isActive: true });
    }
  }, [wc, open]);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListWorkCentersQueryKey() });

  const handleSubmit = () => {
    if (!form.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    const payload = { ...form, setupTimeMinutes: parseInt(form.setupTimeMinutes, 10) };
    const mut = wc ? updateMut.mutateAsync({ id: wc.id, data: payload as any }) : createMut.mutateAsync({ data: payload as any });
    mut.then(() => {
      invalidate();
      toast({ title: wc ? "Centro de trabalho atualizado" : "Centro de trabalho criado" });
      onClose();
    }).catch((e: any) => toast({ title: e?.message ?? "Erro", variant: "destructive" }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{wc ? "Editar" : "Novo"} Centro de Trabalho</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Misturador A" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="machine">Máquina</SelectItem>
                <SelectItem value="work_center">Centro de Trabalho</SelectItem>
                <SelectItem value="line">Linha de Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Capacidade (h/turno)</Label>
              <Input type="number" value={form.capacityHoursPerShift} onChange={e => setForm(f => ({ ...f, capacityHoursPerShift: e.target.value }))} />
            </div>
            <div>
              <Label>Setup (min)</Label>
              <Input type="number" value={form.setupTimeMinutes} onChange={e => setForm(f => ({ ...f, setupTimeMinutes: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schedule Entry Dialog ────────────────────────────────────────────────────

function ScheduleDialog({
  open,
  onClose,
  entry,
  workCenters,
}: {
  open: boolean;
  onClose: () => void;
  entry?: ScheduleEntry | null;
  workCenters: WorkCenter[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const createMut = useCreateApsScheduleEntry();
  const updateMut = useUpdateApsScheduleEntry();

  const toLocalDT = (s: string) => s?.slice(0, 16) ?? "";

  const [form, setForm] = useState({
    workCenterId: entry?.workCenterId?.toString() ?? "",
    scheduledStart: toLocalDT(entry?.scheduledStart ?? ""),
    scheduledEnd: toLocalDT(entry?.scheduledEnd ?? ""),
    productName: entry?.productName ?? "",
    plannedQty: entry?.plannedQty ?? "",
    unit: entry?.unit ?? "kg",
    status: entry?.status ?? "planned",
    priority: entry?.priority?.toString() ?? "5",
    estimatedHours: entry?.estimatedHours ?? "",
    notes: entry?.notes ?? "",
    rescheduledReason: "",
  });

  useEffect(() => {
    if (entry) {
      setForm({
        workCenterId: entry.workCenterId.toString(),
        scheduledStart: toLocalDT(entry.scheduledStart),
        scheduledEnd: toLocalDT(entry.scheduledEnd),
        productName: entry.productName ?? "",
        plannedQty: entry.plannedQty ?? "",
        unit: entry.unit,
        status: entry.status,
        priority: entry.priority.toString(),
        estimatedHours: entry.estimatedHours ?? "",
        notes: entry.notes ?? "",
        rescheduledReason: "",
      });
    } else {
      const now = new Date();
      const start = `${now.toISOString().slice(0, 10)}T07:00`;
      const end = `${now.toISOString().slice(0, 10)}T15:00`;
      setForm({ workCenterId: "", scheduledStart: start, scheduledEnd: end, productName: "", plannedQty: "", unit: "kg", status: "planned", priority: "5", estimatedHours: "", notes: "", rescheduledReason: "" });
    }
  }, [entry, open]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListApsScheduleQueryKey() });
    qc.invalidateQueries({ queryKey: getGetApsDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getGetApsAlertsQueryKey() });
  };

  const handleSubmit = () => {
    if (!form.workCenterId || !form.scheduledStart || !form.scheduledEnd) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" }); return;
    }
    const payload = {
      workCenterId: parseInt(form.workCenterId, 10),
      scheduledStart: form.scheduledStart,
      scheduledEnd: form.scheduledEnd,
      productName: form.productName || null,
      plannedQty: form.plannedQty || null,
      unit: form.unit,
      status: form.status,
      priority: parseInt(form.priority, 10),
      estimatedHours: form.estimatedHours || null,
      notes: form.notes || null,
      rescheduledReason: form.rescheduledReason || null,
    };
    const mut = entry
      ? updateMut.mutateAsync({ id: entry.id, data: payload as any })
      : createMut.mutateAsync({ data: payload as any });
    mut.then((result: any) => {
      invalidate();
      const created = Array.isArray(result) ? result[0] : result;
      if (!entry && created?.orderNumber) {
        toast({ title: `Programação criada — ${created.orderNumber}` });
        if (created?.duplicateWarning) {
          setTimeout(() => toast({ title: "⚠️ Atenção: Produto duplicado", description: created.duplicateWarning, variant: "destructive" }), 400);
        }
      } else {
        toast({ title: entry ? "Entrada atualizada" : "Entrada criada" });
      }
      onClose();
    }).catch((e: any) => toast({ title: e?.response?.data?.error ?? e?.message ?? "Erro ao salvar", variant: "destructive" }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{entry ? "Editar Programação" : "Nova Programação"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Centro de Trabalho *</Label>
            <Select value={form.workCenterId} onValueChange={v => setForm(f => ({ ...f, workCenterId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {workCenters.map(wc => <SelectItem key={wc.id} value={wc.id.toString()}>{wc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input type="datetime-local" value={form.scheduledStart} onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))} />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="datetime-local" value={form.scheduledEnd} onChange={e => setForm(f => ({ ...f, scheduledEnd: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {entry && (
              <div>
                <Label>Nº da OP</Label>
                <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm font-mono text-muted-foreground select-all">
                  {entry.orderNumber ?? "—"}
                </div>
              </div>
            )}
            <div className={entry ? "" : "col-span-2"}>
              <Label>Produto</Label>
              <Input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Qtd</Label>
              <Input type="number" value={form.plannedQty} onChange={e => setForm(f => ({ ...f, plannedQty: e.target.value }))} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
            <div>
              <Label>Horas Est.</Label>
              <Input type="number" value={form.estimatedHours} onChange={e => setForm(f => ({ ...f, estimatedHours: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade (1=Alta, 10=Baixa)</Label>
              <Input type="number" min={1} max={10} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
            </div>
          </div>
          {entry && (
            <div>
              <Label>Motivo da Reprogramação</Label>
              <Input value={form.rescheduledReason} onChange={e => setForm(f => ({ ...f, rescheduledReason: e.target.value }))} placeholder="Opcional" />
            </div>
          )}
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shift Dialog ─────────────────────────────────────────────────────────────

function ShiftDialog({ open, onClose, shift, workCenters }: {
  open: boolean; onClose: () => void; shift?: Shift | null; workCenters: WorkCenter[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const create = useCreateProductionShift();
  const update = useUpdateProductionShift();
  const [form, setForm] = useState({
    workCenterId: "",
    date: todayStr(),
    shiftName: "Turno 1",
    startTime: "07:00",
    endTime: "15:00",
    availableHours: "8",
    isBlocked: false,
    blockReason: "",
  });

  useEffect(() => {
    if (shift) {
      setForm({
        workCenterId: shift.workCenterId.toString(),
        date: shift.date,
        shiftName: shift.shiftName,
        startTime: shift.startTime,
        endTime: shift.endTime,
        availableHours: shift.availableHours?.toString() ?? "8",
        isBlocked: shift.isBlocked ?? false,
        blockReason: shift.blockReason ?? "",
      });
    } else {
      setForm({ workCenterId: "", date: todayStr(), shiftName: "Turno 1", startTime: "07:00", endTime: "15:00", availableHours: "8", isBlocked: false, blockReason: "" });
    }
  }, [shift, open]);

  const handleSubmit = () => {
    if (!form.workCenterId || !form.date) { toast({ title: "Preencha os campos obrigatórios", variant: "destructive" }); return; }
    const payload: any = {
      workCenterId: parseInt(form.workCenterId, 10),
      date: form.date,
      shiftName: form.shiftName,
      startTime: form.startTime,
      endTime: form.endTime,
      availableHours: parseFloat(form.availableHours),
      isBlocked: form.isBlocked,
      blockReason: form.isBlocked ? form.blockReason : null,
    };
    const op = shift ? update.mutateAsync({ id: shift.id, data: payload }) : create.mutateAsync({ data: payload });
    op.then(() => {
      qc.invalidateQueries({ queryKey: getListProductionShiftsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetApsDashboardQueryKey() });
      qc.invalidateQueries({ queryKey: getGetApsAlertsQueryKey() });
      toast({ title: shift ? "Turno atualizado" : "Turno registrado" });
      onClose();
    }).catch((e: any) => toast({ title: e?.response?.data?.error ?? e?.message ?? "Erro", variant: "destructive" }));
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{shift ? "Editar Turno" : "Novo Turno"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Centro de Trabalho *</Label>
            <Select value={form.workCenterId} onValueChange={v => setForm(f => ({ ...f, workCenterId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {workCenters.map(wc => <SelectItem key={wc.id} value={wc.id.toString()}>{wc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Nome do Turno</Label>
              <Select value={form.shiftName} onValueChange={v => setForm(f => ({ ...f, shiftName: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Turno 1">Turno 1 (manhã)</SelectItem>
                  <SelectItem value="Turno 2">Turno 2 (tarde)</SelectItem>
                  <SelectItem value="Turno 3">Turno 3 (noite)</SelectItem>
                  <SelectItem value="Extra">Extra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
            <div>
              <Label>Horas disponíveis</Label>
              <Input type="number" step="0.5" min="0" max="24" value={form.availableHours} onChange={e => setForm(f => ({ ...f, availableHours: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isBlocked"
              checked={form.isBlocked}
              onChange={e => setForm(f => ({ ...f, isBlocked: e.target.checked }))}
              className="w-4 h-4 accent-destructive cursor-pointer"
            />
            <Label htmlFor="isBlocked" className="cursor-pointer text-destructive">Turno bloqueado (parada, manutenção, feriado)</Label>
          </div>
          {form.isBlocked && (
            <div>
              <Label>Motivo do bloqueio</Label>
              <Textarea value={form.blockReason} onChange={e => setForm(f => ({ ...f, blockReason: e.target.value }))} placeholder="Ex: Manutenção preventiva, feriado nacional..." rows={2} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending} variant={form.isBlocked ? "destructive" : "default"}>
            {isPending ? <RefreshCw className="size-4 animate-spin mr-2" /> : null}
            {shift ? "Salvar" : "Registrar Turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Auto-Schedule Dialog ─────────────────────────────────────────────────────

function AutoScheduleDialog({ open, onClose, workCenters }: { open: boolean; onClose: () => void; workCenters: WorkCenter[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const mut = useAutoScheduleAps();
  const [form, setForm] = useState({ workCenterId: "", startDate: todayStr(), hoursPerEntry: "8" });

  const handleSubmit = () => {
    if (!form.workCenterId) { toast({ title: "Selecione um centro de trabalho", variant: "destructive" }); return; }
    mut.mutateAsync({ data: { workCenterId: parseInt(form.workCenterId, 10), startDate: form.startDate, hoursPerEntry: parseFloat(form.hoursPerEntry) } as any })
      .then((res: any) => {
        qc.invalidateQueries({ queryKey: getListApsScheduleQueryKey() });
        qc.invalidateQueries({ queryKey: getGetApsDashboardQueryKey() });
        qc.invalidateQueries({ queryKey: getGetApsAlertsQueryKey() });
        toast({ title: `${res.scheduled} OPs programadas automaticamente` });
        onClose();
      })
      .catch((e: any) => toast({ title: e?.response?.data?.error ?? e?.message ?? "Erro", variant: "destructive" }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Programação Automática</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Aloca automaticamente todas as OPs abertas (planejadas/liberadas) no centro de trabalho selecionado, em sequência por prazo.</p>
        <div className="space-y-3">
          <div>
            <Label>Centro de Trabalho *</Label>
            <Select value={form.workCenterId} onValueChange={v => setForm(f => ({ ...f, workCenterId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {workCenters.map(wc => <SelectItem key={wc.id} value={wc.id.toString()}>{wc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de início</Label>
            <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <Label>Horas por OP</Label>
            <Input type="number" value={form.hoursPerEntry} onChange={e => setForm(f => ({ ...f, hoursPerEntry: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mut.isPending}>
            {mut.isPending ? <RefreshCw className="size-4 animate-spin mr-2" /> : <Wand2 className="size-4 mr-2" />}
            Programar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Simulate Dialog ──────────────────────────────────────────────────────────

function SimulateDialog({ open, onClose, workCenters }: { open: boolean; onClose: () => void; workCenters: WorkCenter[] }) {
  const { toast } = useToast();
  const mut = useSimulateAps();
  const [scenario, setScenario] = useState<"block_period" | "extra_shift">("block_period");
  const [form, setForm] = useState({ workCenterId: "", blockedFrom: "", blockedTo: "", extraShiftHours: "8" });
  const [result, setResult] = useState<any | null>(null);

  const handleSimulate = () => {
    if (!form.workCenterId) { toast({ title: "Selecione um centro de trabalho", variant: "destructive" }); return; }
    const payload: any = { scenario, workCenterId: parseInt(form.workCenterId, 10) };
    if (scenario === "block_period") { payload.blockedFrom = form.blockedFrom; payload.blockedTo = form.blockedTo; }
    else { payload.extraShiftHours = parseFloat(form.extraShiftHours); }
    mut.mutateAsync({ data: payload })
      .then((res: any) => setResult(res))
      .catch((e: any) => toast({ title: e?.response?.data?.error ?? e?.message ?? "Erro", variant: "destructive" }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Simulação de Cenário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cenário</Label>
            <Select value={scenario} onValueChange={v => { setScenario(v as any); setResult(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="block_period">Bloqueio de Período</SelectItem>
                <SelectItem value="extra_shift">Turno Extra</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Centro de Trabalho *</Label>
            <Select value={form.workCenterId} onValueChange={v => setForm(f => ({ ...f, workCenterId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {workCenters.map(wc => <SelectItem key={wc.id} value={wc.id.toString()}>{wc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {scenario === "block_period" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bloqueio de</Label><Input type="datetime-local" value={form.blockedFrom} onChange={e => setForm(f => ({ ...f, blockedFrom: e.target.value }))} /></div>
              <div><Label>Bloqueio até</Label><Input type="datetime-local" value={form.blockedTo} onChange={e => setForm(f => ({ ...f, blockedTo: e.target.value }))} /></div>
            </div>
          )}
          {scenario === "extra_shift" && (
            <div><Label>Horas do turno extra</Label><Input type="number" value={form.extraShiftHours} onChange={e => setForm(f => ({ ...f, extraShiftHours: e.target.value }))} /></div>
          )}
          {result && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-2">
              <p className="font-medium">Resultado da Simulação</p>
              <p className="text-muted-foreground">{result.impact}</p>
              {result.affectedCount != null && <p>OPs afetadas: <strong>{result.affectedCount}</strong></p>}
              {result.currentUtilizationPct != null && (
                <p>Utilização: <strong>{result.currentUtilizationPct}%</strong> → <strong>{result.newUtilizationPct}%</strong></p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handleSimulate} disabled={mut.isPending}>
            {mut.isPending ? <RefreshCw className="size-4 animate-spin mr-2" /> : <FlaskConical className="size-4 mr-2" />}
            Simular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canEditModule } = useAuth();

  const [tab, setTab] = useState("gantt");
  const [ganttStart, setGanttStart] = useState(todayStr());
  const [ganttDays, setGanttDays] = useState(14);

  const [wcDialog, setWcDialog] = useState<{ open: boolean; wc?: WorkCenter | null }>({ open: false });
  const [schedDialog, setSchedDialog] = useState<{ open: boolean; entry?: ScheduleEntry | null }>({ open: false });
  const [shiftDialog, setShiftDialog] = useState<{ open: boolean; shift?: Shift | null }>({ open: false });
  const [autoDialog, setAutoDialog] = useState(false);
  const [simDialog, setSimDialog] = useState(false);
  const [rescheduleDialog, setRescheduleDialog] = useState<{ open: boolean; entryId: number; newWcId: number; newDate: string } | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");

  const [shiftsWcId, setShiftsWcId] = useState("");
  const [shiftsStartDate, setShiftsStartDate] = useState(todayStr());
  const [shiftsEndDate, setShiftsEndDate] = useState(addDays(todayStr(), 14));

  const { data: workCenters = [] } = useListWorkCenters({ active: "true" } as any);
  const { data: allWorkCenters = [] } = useListWorkCenters({} as any);
  const { data: schedule = [] } = useListApsSchedule({
    startDate: ganttStart,
    endDate: addDays(ganttStart, ganttDays),
  } as any);
  const { data: dashboard } = useGetApsDashboard();
  const { data: alerts = [] } = useGetApsAlerts();
  const deleteShift = useDeleteProductionShift();
  const { data: shifts = [] } = useListProductionShifts(
    Object.fromEntries(
      Object.entries({
        workCenterId: shiftsWcId ? parseInt(shiftsWcId, 10) : undefined,
        startDate: shiftsStartDate || undefined,
        endDate: shiftsEndDate || undefined,
      }).filter(([, v]) => v !== undefined)
    ) as any,
    { query: { enabled: tab === "shifts" } as any }
  );

  const deleteSchedule = useDeleteApsScheduleEntry();
  const updateSchedule = useUpdateApsScheduleEntry();
  const deleteWc = useDeleteWorkCenter();

  const handleEntryDrop = (entryId: number, newWorkCenterId: number, newDate: string) => {
    setRescheduleDialog({ open: true, entryId, newWcId: newWorkCenterId, newDate });
    setRescheduleReason("");
  };

  const confirmReschedule = () => {
    if (!rescheduleDialog) return;
    const entry = (schedule as ScheduleEntry[]).find(e => e.id === rescheduleDialog.entryId);
    if (!entry) return;

    const origStart = new Date(entry.scheduledStart.length === 10 ? entry.scheduledStart + "T07:00" : entry.scheduledStart);
    const origEnd = new Date(entry.scheduledEnd.length === 10 ? entry.scheduledEnd + "T15:00" : entry.scheduledEnd);
    const dur = origEnd.getTime() - origStart.getTime();
    const newStart = new Date(rescheduleDialog.newDate + "T07:00");
    const newEnd = new Date(newStart.getTime() + dur);

    const fmt = (d: Date) => `${d.toISOString().slice(0, 10)}T${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

    updateSchedule.mutateAsync({
      id: rescheduleDialog.entryId,
      data: {
        ...entry,
        workCenterId: rescheduleDialog.newWcId,
        scheduledStart: fmt(newStart),
        scheduledEnd: fmt(newEnd),
        rescheduledReason: rescheduleReason || "Reprogramação manual via Gantt",
      } as any,
    }).then(() => {
      qc.invalidateQueries({ queryKey: getListApsScheduleQueryKey() });
      qc.invalidateQueries({ queryKey: getGetApsDashboardQueryKey() });
      toast({ title: "OP reprogramada com sucesso" });
      setRescheduleDialog(null);
    }).catch((e: any) => toast({ title: e?.response?.data?.error ?? "Conflito de capacidade", variant: "destructive" }));
  };

  const kpiCards = [
    { label: "Total Programado", value: dashboard?.totalScheduled ?? 0, icon: CalendarClock, color: "text-blue-600" },
    { label: "Em Produção", value: dashboard?.totalActive ?? 0, icon: PlayCircle, color: "text-yellow-600" },
    { label: "Atrasadas", value: dashboard?.overdueCount ?? 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Conflitos", value: dashboard?.conflictCount ?? 0, icon: XCircle, color: "text-orange-600" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="size-6 text-cyan-500" />
              APS — Planejamento Avançado da Produção
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Programação, Gantt interativo e simulações de capacidade</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSimDialog(true)}>
              <FlaskConical className="size-4 mr-1.5" />
              Simular
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAutoDialog(true)}>
              <Wand2 className="size-4 mr-1.5" />
              Programação Auto
            </Button>
            {canEditModule('aps') && (
              <Button size="sm" onClick={() => setSchedDialog({ open: true, entry: null })}>
                <Plus className="size-4 mr-1.5" />
                Nova Programação
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map((k) => (
            <Card key={k.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <k.icon className={cn("size-8", k.color)} />
                <div>
                  <p className="text-2xl font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
            <TabsTrigger value="schedule">Programações</TabsTrigger>
            <TabsTrigger value="shifts">Turnos</TabsTrigger>
            <TabsTrigger value="work-centers">Centros de Trabalho</TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-1.5">
              Alertas
              {alerts.length > 0 && <Badge variant="destructive" className="h-4 px-1 text-xs">{alerts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="utilization">Capacidade / OEE</TabsTrigger>
          </TabsList>

          {/* ─── Gantt Tab ─── */}
          <TabsContent value="gantt" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setGanttStart(addDays(ganttStart, -ganttDays))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Input type="date" className="w-40 h-8 text-sm" value={ganttStart} onChange={e => setGanttStart(e.target.value)} />
                <Button variant="outline" size="sm" onClick={() => setGanttStart(addDays(ganttStart, ganttDays))}>
                  <ChevronRight className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setGanttStart(todayStr())}>Hoje</Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Período:</span>
                {[7, 14, 21, 30].map(d => (
                  <Button key={d} variant={ganttDays === d ? "secondary" : "outline"} size="sm" className="h-7 px-2" onClick={() => setGanttDays(d)}>
                    {d}d
                  </Button>
                ))}
              </div>
            </div>

            {(workCenters as WorkCenter[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/20">
                <Factory className="size-12 text-muted-foreground mb-3" />
                <p className="font-medium">Nenhum centro de trabalho cadastrado</p>
                <p className="text-sm text-muted-foreground mb-4">Crie centros de trabalho para visualizar o Gantt</p>
                <Button onClick={() => { setTab("work-centers"); setWcDialog({ open: true }); }}>
                  <Plus className="size-4 mr-1.5" /> Novo Centro de Trabalho
                </Button>
              </div>
            ) : (
              <GanttChart
                workCenters={workCenters as WorkCenter[]}
                entries={schedule as ScheduleEntry[]}
                startDate={ganttStart}
                days={ganttDays}
                onEntryClick={(e) => setSchedDialog({ open: true, entry: e })}
                onEntryDrop={handleEntryDrop}
              />
            )}

            {/* Legend */}
            <div className="flex gap-4 mt-3 flex-wrap">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5 text-xs">
                  <div className={cn("w-3 h-3 rounded", v.bg)} />
                  <span className="text-muted-foreground">{v.label}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ─── Schedule Table Tab ─── */}
          <TabsContent value="schedule" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Programações</CardTitle>
                  <Button size="sm" onClick={() => setSchedDialog({ open: true, entry: null })}>
                    <Plus className="size-4 mr-1.5" /> Nova
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">OP / Produto</th>
                        <th className="text-left py-2 px-3">Centro</th>
                        <th className="text-left py-2 px-3">Início</th>
                        <th className="text-left py-2 px-3">Fim</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Prioridade</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(schedule as ScheduleEntry[]).length === 0 && (
                        <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma programação encontrada</td></tr>
                      )}
                      {(schedule as ScheduleEntry[]).map((e) => {
                        const cfg = STATUS_CONFIG[e.status];
                        return (
                          <tr key={e.id} className="border-b hover:bg-muted/30">
                            <td className="py-2 px-3">
                              <p className="font-medium">{e.orderNumber ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">{e.productName}</p>
                            </td>
                            <td className="py-2 px-3">{e.workCenterName}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{formatDT(e.scheduledStart)}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{formatDT(e.scheduledEnd)}</td>
                            <td className="py-2 px-3">
                              <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white", cfg?.bg)}>
                                {cfg?.label}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">{e.priority}</td>
                            <td className="py-2 px-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSchedDialog({ open: true, entry: e })}>Editar</Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => {
                                  deleteSchedule.mutateAsync({ id: e.id }).then(() => {
                                    qc.invalidateQueries({ queryKey: getListApsScheduleQueryKey() });
                                    qc.invalidateQueries({ queryKey: getGetApsDashboardQueryKey() });
                                    toast({ title: "Programação removida" });
                                  });
                                }}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Shifts Tab ─── */}
          <TabsContent value="shifts" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="size-4 text-cyan-500" />
                    Calendário de Turnos
                  </CardTitle>
                  <Button size="sm" onClick={() => setShiftDialog({ open: true, shift: null })}>
                    <Plus className="size-4 mr-1.5" /> Novo Turno
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Centro:</Label>
                    <Select value={shiftsWcId} onValueChange={setShiftsWcId}>
                      <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos</SelectItem>
                        {(allWorkCenters as WorkCenter[]).map(wc => <SelectItem key={wc.id} value={wc.id.toString()}>{wc.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">De:</Label>
                    <Input type="date" className="h-8 text-xs w-36" value={shiftsStartDate} onChange={e => setShiftsStartDate(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Até:</Label>
                    <Input type="date" className="h-8 text-xs w-36" value={shiftsEndDate} onChange={e => setShiftsEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">Data</th>
                        <th className="text-left py-2 px-3">Centro de Trabalho</th>
                        <th className="text-left py-2 px-3">Turno</th>
                        <th className="text-left py-2 px-3">Horário</th>
                        <th className="text-left py-2 px-3">Horas Disp.</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(shifts as Shift[]).length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-muted-foreground">
                            <Clock className="size-8 mx-auto mb-2 opacity-30" />
                            <p>Nenhum turno registrado para o período selecionado</p>
                          </td>
                        </tr>
                      )}
                      {(shifts as Shift[]).map(s => {
                        const wc = (allWorkCenters as WorkCenter[]).find(w => w.id === s.workCenterId);
                        return (
                          <tr key={s.id} className={cn("border-b hover:bg-muted/30", s.isBlocked && "bg-red-50 dark:bg-red-950/20")}>
                            <td className="py-2 px-3 font-medium whitespace-nowrap">{s.date}</td>
                            <td className="py-2 px-3">{wc?.name ?? `CT #${s.workCenterId}`}</td>
                            <td className="py-2 px-3">{s.shiftName}</td>
                            <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{s.startTime} – {s.endTime}</td>
                            <td className="py-2 px-3 text-center">{s.availableHours}h</td>
                            <td className="py-2 px-3">
                              {s.isBlocked ? (
                                <div>
                                  <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                                  {s.blockReason && <p className="text-xs text-muted-foreground mt-0.5 max-w-[180px] truncate">{s.blockReason}</p>}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-400">Disponível</Badge>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShiftDialog({ open: true, shift: s })}>
                                  <Settings className="size-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => {
                                  deleteShift.mutateAsync({ id: s.id }).then(() => {
                                    qc.invalidateQueries({ queryKey: getListProductionShiftsQueryKey() });
                                    qc.invalidateQueries({ queryKey: getGetApsDashboardQueryKey() });
                                    qc.invalidateQueries({ queryKey: getGetApsAlertsQueryKey() });
                                    toast({ title: "Turno removido" });
                                  });
                                }}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Work Centers Tab ─── */}
          <TabsContent value="work-centers" className="mt-4">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => setWcDialog({ open: true, wc: null })}>
                <Plus className="size-4 mr-1.5" /> Novo Centro
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(allWorkCenters as WorkCenter[]).map((wc) => (
                <Card key={wc.id} className={cn(!wc.isActive && "opacity-60")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Factory className="size-4 text-cyan-500" />
                          <p className="font-semibold">{wc.name}</p>
                          {!wc.isActive && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{wc.type.replace("_", " ")}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setWcDialog({ open: true, wc })}>
                          <Settings className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => {
                          deleteWc.mutateAsync({ id: wc.id }).then(() => {
                            qc.invalidateQueries({ queryKey: getListWorkCentersQueryKey() });
                            toast({ title: "Centro desativado" });
                          });
                        }}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
                      <span>⏱ {wc.capacityHoursPerShift}h/turno</span>
                      <span>🔧 Setup: {wc.setupTimeMinutes}min</span>
                    </div>
                    {wc.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{wc.description}</p>}
                  </CardContent>
                </Card>
              ))}
              {(allWorkCenters as WorkCenter[]).length === 0 && (
                <div className="col-span-3 flex flex-col items-center py-16 text-center text-muted-foreground">
                  <Factory className="size-12 mb-3 opacity-40" />
                  <p>Nenhum centro de trabalho cadastrado</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── Alerts Tab ─── */}
          <TabsContent value="alerts" className="mt-4">
            <div className="space-y-3">
              {alerts.length === 0 && (
                <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
                  <CheckCircle2 className="size-12 mb-3 text-green-500 opacity-60" />
                  <p className="font-medium">Nenhum alerta ativo</p>
                  <p className="text-sm">A programação está sem conflitos ou pendências.</p>
                </div>
              )}
              {(alerts as Array<{ type: string; severity: string; message: string; entityId?: number }>).map((a, i) => {
                const cfg = SEVERITY_CONFIG[a.severity] ?? SEVERITY_CONFIG.medium;
                const Icon = cfg.icon;
                return (
                  <div key={i} className={cn("flex items-start gap-3 p-3 rounded-lg border", cfg.bg)}>
                    <Icon className={cn("size-5 flex-shrink-0 mt-0.5", cfg.color)} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.message}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.type.replace("_", " ")} · {a.severity}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ─── Utilization / OEE Tab ─── */}
          <TabsContent value="utilization" className="mt-4">
            <div className="grid gap-4">
              {/* OEE Simplified Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="size-4 text-cyan-500" />
                    OEE Simplificado — Últimos 7 dias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">
                    OEE = Disponibilidade × Performance. Disponibilidade: horas programadas / horas de capacidade. Performance: horas concluídas / horas programadas.
                  </p>
                  {(!dashboard?.oeeByWorkCenter || (dashboard.oeeByWorkCenter as any[]).length === 0) ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Sem dados de OEE — nenhuma entrada concluída nos últimos 7 dias</p>
                  ) : (
                    <div className="space-y-5">
                      {(dashboard.oeeByWorkCenter as any[]).map((o, i) => {
                        const oeeColor = o.oee >= 70 ? "bg-green-500" : o.oee >= 45 ? "bg-yellow-500" : "bg-red-500";
                        return (
                          <div key={i} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{o.workCenterName ?? `CT #${o.workCenterId}`}</span>
                              <span className={cn("font-bold text-base", o.oee >= 70 ? "text-green-600" : o.oee >= 45 ? "text-yellow-600" : "text-red-600")}>
                                OEE {o.oee}%
                              </span>
                            </div>
                            <div className="h-4 bg-muted rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", oeeColor)} style={{ width: `${o.oee}%` }} />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                              <span>📅 Disponib.: <strong>{o.availability}%</strong></span>
                              <span>⚡ Perf.: <strong>{o.performance}%</strong></span>
                              <span>✅ Concluído: <strong>{parseFloat(o.doneHours ?? 0).toFixed(1)}h</strong> / {parseFloat(o.plannedHours ?? 0).toFixed(1)}h programadas</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Capacity Utilization next 7 days */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Factory className="size-4 text-cyan-500" />
                    Carga de Capacidade (próximos 7 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(!dashboard?.utilizationByWorkCenter || dashboard.utilizationByWorkCenter.length === 0) ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Nenhuma programação nos próximos 7 dias</p>
                  ) : (
                    <div className="space-y-4">
                      {(dashboard.utilizationByWorkCenter as any[]).map((u, i) => {
                        const scheduled = parseFloat(u.scheduledHours ?? "0");
                        const capacity = parseFloat(u.capacityHours ?? "1");
                        const pct = Math.min(100, capacity > 0 ? (scheduled / capacity) * 100 : 0);
                        const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{u.workCenterName ?? `CT #${u.workCenterId}`}</span>
                              <span className="text-muted-foreground">{scheduled.toFixed(1)}h / {capacity.toFixed(0)}h disponíveis ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Próximas Programações</CardTitle>
                </CardHeader>
                <CardContent>
                  {(!dashboard?.upcoming || dashboard.upcoming.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma programação futura</p>
                  ) : (
                    <div className="space-y-2">
                      {(dashboard.upcoming as any[]).map((u, i) => {
                        const cfg = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.planned;
                        return (
                          <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                            <div className={cn("w-2 h-10 rounded-full flex-shrink-0", cfg.bg)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{u.orderNumber ?? "Sem OP"} · {u.productName ?? ""}</p>
                              <p className="text-xs text-muted-foreground">{u.workCenterName} · {formatDT(u.scheduledStart)} → {formatDT(u.scheduledEnd)}</p>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">P{u.priority}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <WorkCenterDialog
        open={wcDialog.open}
        onClose={() => setWcDialog({ open: false })}
        wc={wcDialog.wc}
      />
      <ScheduleDialog
        open={schedDialog.open}
        onClose={() => setSchedDialog({ open: false })}
        entry={schedDialog.entry}
        workCenters={workCenters as WorkCenter[]}
      />
      <ShiftDialog
        open={shiftDialog.open}
        onClose={() => setShiftDialog({ open: false })}
        shift={shiftDialog.shift}
        workCenters={allWorkCenters as WorkCenter[]}
      />
      <AutoScheduleDialog open={autoDialog} onClose={() => setAutoDialog(false)} workCenters={workCenters as WorkCenter[]} />
      <SimulateDialog open={simDialog} onClose={() => setSimDialog(false)} workCenters={allWorkCenters as WorkCenter[]} />

      {/* Reschedule confirmation dialog */}
      {rescheduleDialog && (
        <Dialog open={true} onOpenChange={(v) => !v && setRescheduleDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Confirmar Reprogramação</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Mover OP para {rescheduleDialog.newDate} no centro de trabalho selecionado.
            </p>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} placeholder="Ex: Prioridade do cliente" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleDialog(null)}>Cancelar</Button>
              <Button onClick={confirmReschedule} disabled={updateSchedule.isPending}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
