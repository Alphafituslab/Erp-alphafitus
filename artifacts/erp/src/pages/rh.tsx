import { useState, useMemo, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/contexts/auth";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEmployees,
  useCreateEmployee,
  useGetEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useListDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useListAttendanceLogs,
  useCreateAttendanceLog,
  useUpdateAttendanceLog,
  useDeleteAttendanceLog,
  useGetAttendanceSummary,
  useGetRhDashboard,
  useListTrainings,
  useCreateTraining,
  useUpdateTraining,
  useDeleteTraining,
  useGetTrainingMatrix,
  useGetTrainingCompliance,
  useListEmployeeTrainings,
  useAddEmployeeTraining,
  useDeleteEmployeeTraining,
  useListPayrollEntries,
  useGeneratePayroll,
  useUpdatePayrollStatus,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getListAttendanceLogsQueryKey,
  getGetRhDashboardQueryKey,
  getListTrainingsQueryKey,
  getGetTrainingMatrixQueryKey,
  getGetTrainingComplianceQueryKey,
  getListEmployeeTrainingsQueryKey,
  getListPayrollEntriesQueryKey,
} from "@workspace/api-client-react";
import type {
  Employee,
  EmployeeWithAttendance,
  Department,
  AttendanceLog,
  Training,
  EmployeeTraining,
  PayrollEntryWithEmployee,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Users,
  Building2,
  UserCheck,
  UserX,
  Plus,
  Pencil,
  Trash2,
  Eye,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  BookOpen,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  Award,
  Upload,
  Filter,
  KeyRound,
  DollarSign,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function fmtCurrency(v?: string | null): string {
  if (!v) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusBadge(status: string) {
  return <StatusBadge status={status} />;
}

function attendanceBadge(status: string) {
  return <StatusBadge status={status} />;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  const date = new Date(Number(y), Number(mo) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function daysInMonth(m: string): string[] {
  const [y, mo] = m.split("-").map(Number);
  const days = new Date(y, mo, 0).getDate();
  return Array.from({ length: days }, (_, i) =>
    `${m}-${String(i + 1).padStart(2, "0")}`
  );
}

// ─── Employee Dialog ──────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  cpf: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.trim() === "" || v.replace(/\D/g, "").length === 11,
      "CPF deve ter 11 dígitos"
    ),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().min(1, "Obrigatório"),
  department: z.string().optional(),
  hireDate: z.string().optional(),
  salary: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  systemAccessEnabled: z.boolean().default(false),
  systemAccessEmail: z.string().optional(),
  systemAccessPassword: z.string().optional(),
  systemAccessRole: z.enum(["admin", "manager", "employee"]).optional(),
}).refine(
  (d) => {
    if (!d.systemAccessEnabled) return true;
    return !!d.systemAccessEmail;
  },
  { message: "Email de acesso obrigatório", path: ["systemAccessEmail"] }
);
type EmployeeForm = z.infer<typeof employeeSchema>;

function EmployeeDialog({
  open,
  onClose,
  editing,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  editing: Employee | null;
  departments: Department[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createM = useCreateEmployee();
  const updateM = useUpdateEmployee();

  const form = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "", cpf: "", email: "", phone: "", role: "", department: "",
      hireDate: "", salary: "", status: "active",
      systemAccessEnabled: false, systemAccessEmail: "", systemAccessPassword: "", systemAccessRole: "employee",
    },
  });

  const accessEnabled = form.watch("systemAccessEnabled");
  const lu = (editing as any)?.linkedUser as { id: number; email: string; role: string; active: string } | null | undefined;

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({
          name: editing.name ?? "",
          cpf: editing.cpf ?? "",
          email: editing.email ?? "",
          phone: editing.phone ?? "",
          role: editing.role ?? "",
          department: editing.department ?? "",
          hireDate: editing.hireDate ? new Date(editing.hireDate).toISOString().slice(0, 10) : "",
          salary: editing.salary ?? "",
          status: (editing.status as "active" | "inactive") ?? "active",
          systemAccessEnabled: !!lu && lu.active === "true",
          systemAccessEmail: lu?.email ?? "",
          systemAccessPassword: "",
          systemAccessRole: (lu?.role as any) ?? "employee",
        });
      } else {
        form.reset({
          name: "", cpf: "", email: "", phone: "", role: "", department: "",
          hireDate: "", salary: "", status: "active",
          systemAccessEnabled: false, systemAccessEmail: "", systemAccessPassword: "", systemAccessRole: "employee",
        });
      }
    }
  }, [open, editing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRhDashboardQueryKey() });
  };

  const onSubmit = form.handleSubmit((data) => {
    const payload: any = {
      name: data.name,
      cpf: data.cpf || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: data.role,
      department: data.department || undefined,
      hireDate: data.hireDate ? new Date(data.hireDate).toISOString() : undefined,
      salary: data.salary || undefined,
      status: data.status,
      systemAccessEnabled: data.systemAccessEnabled,
      systemAccessEmail: data.systemAccessEnabled ? data.systemAccessEmail : undefined,
      systemAccessPassword: data.systemAccessEnabled && data.systemAccessPassword ? data.systemAccessPassword : undefined,
      systemAccessRole: data.systemAccessEnabled ? data.systemAccessRole : undefined,
    };

    if (editing) {
      updateM.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => { toast({ title: "Funcionário atualizado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.data?.error ?? e?.message, variant: "destructive" }),
        }
      );
    } else {
      createM.mutate(
        { data: payload },
        {
          onSuccess: () => { toast({ title: "Funcionário cadastrado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.data?.error ?? e?.message, variant: "destructive" }),
        }
      );
    }
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nome *</Label>
              <Input {...form.register("name")} placeholder="Nome completo" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input {...form.register("cpf")} placeholder="000.000.000-00" />
              {form.formState.errors.cpf && (
                <p className="text-xs text-destructive">{form.formState.errors.cpf.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Cargo *</Label>
              <Input {...form.register("role")} placeholder="Ex: Analista, Gerente" />
              {form.formState.errors.role && (
                <p className="text-xs text-destructive">{form.formState.errors.role.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...form.register("email")} type="email" placeholder="email@empresa.com" />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input {...form.register("phone")} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label>Departamento</Label>
              <Controller
                control={form.control}
                name="department"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Data de admissão</Label>
              <Input {...form.register("hireDate")} type="date" />
            </div>
            <div className="space-y-1">
              <Label>Salário (R$)</Label>
              <Input {...form.register("salary")} type="number" step="0.01" placeholder="0,00" />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* ── System Access Section ───────────────────────────────────────── */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Acesso ao Sistema</span>
              </div>
              <Controller
                control={form.control}
                name="systemAccessEnabled"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            {accessEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Email de login *</Label>
                  <Input {...form.register("systemAccessEmail")} type="email" placeholder="login@empresa.com.br" />
                  {form.formState.errors.systemAccessEmail && (
                    <p className="text-xs text-destructive">{form.formState.errors.systemAccessEmail.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>{editing && lu ? "Nova senha (deixe em branco para manter)" : "Senha inicial *"}</Label>
                  <Input {...form.register("systemAccessPassword")} type="password" placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="space-y-1">
                  <Label>Perfil de acesso</Label>
                  <Controller
                    control={form.control}
                    name="systemAccessRole"
                    render={({ field }) => (
                      <Select value={field.value ?? "employee"} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Colaborador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            )}
            {!accessEnabled && editing && lu && lu.active === "true" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Ao salvar com acesso desabilitado, o acesso do usuário será inativado.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Employee Drawer ──────────────────────────────────────────────────────────

function EmployeeDrawer({
  employeeId,
  onClose,
  onEdit,
}: {
  employeeId: number | null;
  onClose: () => void;
  onEdit: (emp: Employee) => void;
}) {
  const { data: emp } = useGetEmployee(employeeId ?? 0, {
    query: { enabled: employeeId !== null } as any,
  });
  const profile = emp as EmployeeWithAttendance | undefined;
  const lu = profile
    ? ((profile as any).linkedUser as { id: number; email: string; role: string; active: string } | null)
    : null;

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrador",
    manager: "Gerente",
    employee: "Colaborador",
  };

  return (
    <Sheet open={employeeId !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-lg">{profile?.name ?? "Carregando…"}</SheetTitle>
          {profile && (
            <div className="flex items-center gap-2 mt-1">
              {statusBadge(profile.status)}
              {lu && lu.active === "true" && (
                <Badge variant="outline" className="text-xs gap-1">
                  <KeyRound className="h-3 w-3" />
                  {ROLE_LABELS[lu.role] ?? lu.role}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {profile && (
            <>
              {/* Personal Info */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Dados Pessoais
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">CPF:</span>{" "}
                    <span className="font-medium">{profile.cpf ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cargo:</span>{" "}
                    <span className="font-medium">{profile.role}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Departamento:</span>{" "}
                    <span className="font-medium">{profile.department ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Admissão:</span>{" "}
                    <span className="font-medium">{fmtDate(profile.hireDate)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Salário:</span>{" "}
                    <span className="font-medium">{fmtCurrency(profile.salary)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="font-medium">{profile.email ?? "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Telefone:</span>{" "}
                    <span className="font-medium">{profile.phone ?? "—"}</span>
                  </div>
                </div>
              </div>

              {/* System Access */}
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Acesso ao Sistema</span>
                </div>
                {lu && lu.active === "true" ? (
                  <div className="space-y-1.5 text-sm">
                    <div>
                      <span className="text-muted-foreground">Login:</span>{" "}
                      <span className="font-medium">{lu.email}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Perfil:</span>{" "}
                      <span className="font-medium">{ROLE_LABELS[lu.role] ?? lu.role}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-1">
                      <UserCheck className="h-3.5 w-3.5" /> Acesso ativo
                    </div>
                  </div>
                ) : lu && lu.active === "false" ? (
                  <div className="space-y-1.5 text-sm">
                    <div>
                      <span className="text-muted-foreground">Login:</span>{" "}
                      <span className="font-medium">{lu.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mt-1">
                      <UserX className="h-3.5 w-3.5" /> Acesso inativo
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sem acesso ao sistema. Use o botão Editar para habilitar.
                  </p>
                )}
              </div>

              {/* Recent Attendance */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Ponto Recente (últimos 7)
                </h3>
                {!profile.attendance || profile.attendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro de ponto.</p>
                ) : (
                  <div className="space-y-0 border rounded-lg overflow-hidden">
                    {profile.attendance.slice(0, 7).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 bg-background"
                      >
                        <span className="text-muted-foreground w-24">{a.date}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.checkIn ?? "—"} → {a.checkOut ?? "—"}
                        </span>
                        {attendanceBadge(a.status)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-2">
          <Button
            onClick={() => {
              if (profile) onEdit(profile as unknown as Employee);
              onClose();
            }}
          >
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </Button>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Department Dialog ────────────────────────────────────────────────────────

const deptSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
});
type DeptForm = z.infer<typeof deptSchema>;

function DepartmentDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Department | null;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createM = useCreateDepartment();
  const updateM = useUpdateDepartment();

  const form = useForm<DeptForm>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? "",
        description: editing?.description ?? "",
      });
    }
  }, [open, editing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRhDashboardQueryKey() });
  };

  const onSubmit = form.handleSubmit((data) => {
    if (editing) {
      updateM.mutate(
        { id: editing.id, data },
        {
          onSuccess: () => { toast({ title: "Departamento atualizado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    } else {
      createM.mutate(
        { data },
        {
          onSuccess: () => { toast({ title: "Departamento criado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input {...form.register("name")} placeholder="Ex: Financeiro, TI" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea {...form.register("description")} rows={3} placeholder="Descrição opcional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending || updateM.isPending}>
              {createM.isPending || updateM.isPending ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Attendance Log Dialog ────────────────────────────────────────────────────

const attendanceSchema = z.object({
  employeeId: z.string().min(1, "Obrigatório"),
  date: z.string().min(1, "Obrigatório"),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(["present", "absent", "late"]).default("present"),
  notes: z.string().optional(),
});
type AttendanceForm = z.infer<typeof attendanceSchema>;

function AttendanceDialog({
  open,
  onClose,
  editing,
  defaultEmployeeId,
  defaultDate,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  editing: AttendanceLog | null;
  defaultEmployeeId?: string;
  defaultDate?: string;
  employees: Employee[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createM = useCreateAttendanceLog();
  const updateM = useUpdateAttendanceLog();

  const form = useForm<AttendanceForm>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      employeeId: "",
      date: "",
      checkIn: "",
      checkOut: "",
      status: "present",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({
          employeeId: editing.employeeId,
          date: editing.date,
          checkIn: editing.checkIn ?? "",
          checkOut: editing.checkOut ?? "",
          status: editing.status as "present" | "absent" | "late",
          notes: editing.notes ?? "",
        });
      } else {
        form.reset({
          employeeId: defaultEmployeeId ?? "",
          date: defaultDate ?? "",
          checkIn: "",
          checkOut: "",
          status: "present",
          notes: "",
        });
      }
    }
  }, [open, editing, defaultEmployeeId, defaultDate]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListAttendanceLogsQueryKey() });
  };

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      ...data,
      checkIn: data.checkIn || undefined,
      checkOut: data.checkOut || undefined,
      notes: data.notes || undefined,
    };

    if (editing) {
      updateM.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => { toast({ title: "Registro atualizado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    } else {
      createM.mutate(
        { data: payload },
        {
          onSuccess: () => { toast({ title: "Ponto registrado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Registro" : "Registrar Ponto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Funcionário *</Label>
            <Controller
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar funcionário…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Selecionar —</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.employeeId && (
              <p className="text-xs text-destructive">{form.formState.errors.employeeId.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input {...form.register("date")} type="date" />
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Presente</SelectItem>
                      <SelectItem value="absent">Ausente</SelectItem>
                      <SelectItem value="late">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Entrada</Label>
              <Input {...form.register("checkIn")} type="time" />
            </div>
            <div className="space-y-1">
              <Label>Saída</Label>
              <Input {...form.register("checkOut")} type="time" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea {...form.register("notes")} rows={2} placeholder="Opcional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending || updateM.isPending}>
              {createM.isPending || updateM.isPending ? "Salvando…" : editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Training Status Helpers ──────────────────────────────────────────────────

function trainingStatusLabel(s: string) {
  if (s === "up_to_date") return "Em dia";
  if (s === "expiring_soon") return "Vencendo";
  if (s === "expired") return "Vencido";
  if (s === "not_applicable") return "N/A";
  return "Não realizado";
}

function trainingStatusColor(s: string): string {
  if (s === "up_to_date") return "bg-green-100 text-green-800";
  if (s === "expiring_soon") return "bg-yellow-100 text-yellow-800";
  if (s === "expired") return "bg-red-100 text-red-800";
  if (s === "not_applicable") return "bg-slate-100 text-slate-500";
  return "bg-gray-100 text-gray-600";
}

function trainingMatrixCellClass(s: string): string {
  if (s === "up_to_date") return "bg-green-500";
  if (s === "expiring_soon") return "bg-yellow-400";
  if (s === "expired") return "bg-red-500";
  if (s === "not_applicable") return "bg-slate-200 border border-dashed border-slate-400";
  return "bg-gray-200";
}

// ─── Training Dialog ──────────────────────────────────────────────────────────

const trainingSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
  type: z.enum(["mandatory", "optional"]).default("mandatory"),
  validityMonths: z.string().optional(),
  durationHours: z.string().optional(),
  targetRole: z.string().optional(),
});
type TrainingForm = z.infer<typeof trainingSchema>;

function TrainingDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Training | null;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createM = useCreateTraining();
  const updateM = useUpdateTraining();

  const form = useForm<TrainingForm>({
    resolver: zodResolver(trainingSchema),
    defaultValues: { name: "", description: "", type: "mandatory", validityMonths: "", durationHours: "", targetRole: "" },
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({
          name: editing.name,
          description: editing.description ?? "",
          type: (editing.type as "mandatory" | "optional") ?? "mandatory",
          validityMonths: editing.validityMonths ? String(editing.validityMonths) : "",
          durationHours: editing.durationHours ? String(editing.durationHours) : "",
          targetRole: editing.targetRole ?? "",
        });
      } else {
        form.reset({ name: "", description: "", type: "mandatory", validityMonths: "", durationHours: "", targetRole: "" });
      }
    }
  }, [open, editing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListTrainingsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTrainingMatrixQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRhDashboardQueryKey() });
  };

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      type: data.type,
      validityMonths: data.validityMonths ? Number(data.validityMonths) : undefined,
      durationHours: data.durationHours ? Number(data.durationHours) : undefined,
      targetRole: data.targetRole || undefined,
    };
    if (editing) {
      updateM.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => { toast({ title: "Treinamento atualizado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    } else {
      createM.mutate(
        { data: payload },
        {
          onSuccess: () => { toast({ title: "Treinamento criado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Treinamento" : "Novo Treinamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input {...form.register("name")} placeholder="Ex: BPF, Uso de EPI, Operação de equipamento" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea {...form.register("description")} rows={2} placeholder="Descrição opcional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mandatory">Obrigatório</SelectItem>
                      <SelectItem value="optional">Opcional</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Validade (meses)</Label>
              <Input {...form.register("validityMonths")} type="number" min="1" placeholder="Ex: 12 (vazio = sem venc.)" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Carga horária (h)</Label>
              <Input {...form.register("durationHours")} type="number" min="1" placeholder="Ex: 8" />
            </div>
            <div className="space-y-1">
              <Label>Cargo alvo</Label>
              <Input {...form.register("targetRole")} placeholder="Ex: Operador (vazio = todos)" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createM.isPending || updateM.isPending}>
              {createM.isPending || updateM.isPending ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Training Dialog ───────────────────────────────────────────────────

const recordTrainingSchema = z.object({
  trainingId: z.string().min(1, "Selecione um treinamento"),
  completedAt: z.string().min(1, "Data de realização obrigatória"),
  notes: z.string().optional(),
});
type RecordTrainingForm = z.infer<typeof recordTrainingSchema>;

function RecordTrainingDialog({
  open,
  onClose,
  employeeId,
  employeeName,
  availableTrainings,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: number | null;
  employeeName: string;
  availableTrainings: Training[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const addM = useAddEmployeeTraining();

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const form = useForm<RecordTrainingForm>({
    resolver: zodResolver(recordTrainingSchema),
    defaultValues: { trainingId: "", completedAt: "", notes: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ trainingId: "", completedAt: new Date().toISOString().slice(0, 10), notes: "" });
      setEvidenceFile(null);
      setUploadedUrl(null);
    }
  }, [open]);

  const invalidate = (empId: number) => {
    qc.invalidateQueries({ queryKey: getListEmployeeTrainingsQueryKey(empId) });
    qc.invalidateQueries({ queryKey: getGetTrainingMatrixQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTrainingComplianceQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRhDashboardQueryKey() });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvidenceFile(file);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/rh/upload-evidence", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error("Falha no upload");
      const json = await res.json();
      setUploadedUrl(json.url);
    } catch {
      toast({ title: "Erro no upload", description: "Não foi possível enviar o arquivo", variant: "destructive" });
      setEvidenceFile(null);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = form.handleSubmit((data) => {
    if (!employeeId) return;
    addM.mutate(
      {
        id: employeeId,
        data: {
          trainingId: Number(data.trainingId),
          completedAt: data.completedAt ? new Date(data.completedAt).toISOString() : undefined,
          evidenceUrl: uploadedUrl || undefined,
          notes: data.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Treinamento registrado" });
          invalidate(employeeId);
          onClose();
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Treinamento — {employeeName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Treinamento *</Label>
            <Controller
              control={form.control}
              name="trainingId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Selecionar —</SelectItem>
                    {availableTrainings.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} {t.type === "mandatory" ? "(Obrigatório)" : "(Opcional)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.trainingId && (
              <p className="text-xs text-destructive">{form.formState.errors.trainingId.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Data de realização *</Label>
            <Input {...form.register("completedAt")} type="date" />
            {form.formState.errors.completedAt && (
              <p className="text-xs text-destructive">{form.formState.errors.completedAt.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Evidência (arquivo)</Label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input text-sm hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Enviando…" : "Selecionar arquivo"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
              {evidenceFile && !uploading && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                  {uploadedUrl
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    : <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                  <span className="truncate max-w-[160px]">{evidenceFile.name}</span>
                </div>
              )}
              {uploading && <span className="text-xs text-muted-foreground">Enviando…</span>}
            </div>
            <p className="text-xs text-muted-foreground">PDF, imagem, Word, Excel ou PowerPoint (máx. 20MB)</p>
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea {...form.register("notes")} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={addM.isPending || uploading}>
              {addM.isPending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Employee Training Panel (inline) ────────────────────────────────────────

function EmployeeTrainingPanel({
  employeeId,
  employeeName,
  trainings,
}: {
  employeeId: number;
  employeeName: string;
  trainings: Training[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: records = [] } = useListEmployeeTrainings(employeeId);
  const deleteM = useDeleteEmployeeTraining();
  const [recordDialog, setRecordDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListEmployeeTrainingsQueryKey(employeeId) });
    qc.invalidateQueries({ queryKey: getGetTrainingMatrixQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTrainingComplianceQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRhDashboardQueryKey() });
  };

  const handleDelete = (id: number) => {
    deleteM.mutate(
      { id },
      {
        onSuccess: () => { toast({ title: "Registro removido" }); invalidate(); },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const filteredRecords = records.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.trainingType !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold text-muted-foreground">Treinamentos de {employeeName}</h4>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-7 text-xs w-[130px]">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="mandatory">Obrigatório</SelectItem>
              <SelectItem value="optional">Opcional</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="up_to_date">Em dia</SelectItem>
              <SelectItem value="expiring_soon">Vencendo</SelectItem>
              <SelectItem value="expired">Vencido</SelectItem>
              <SelectItem value="not_done">Não realizado</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRecordDialog(true)}>
            <Plus className="h-3 w-3 mr-1" /> Registrar
          </Button>
        </div>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nenhum treinamento registrado.</p>
      ) : filteredRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nenhum resultado para os filtros selecionados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Treinamento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Realizado</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evidência</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-sm">{r.trainingName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {r.trainingType === "mandatory" ? "Obrigatório" : "Opcional"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{r.completedAt ? fmtDate(r.completedAt) : "—"}</TableCell>
                <TableCell className="text-sm">{r.expiresAt ? fmtDate(r.expiresAt) : "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trainingStatusColor(r.status)}`}>
                    {trainingStatusLabel(r.status)}
                  </span>
                </TableCell>
                <TableCell>
                  {r.evidenceUrl ? (
                    <a
                      href={r.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Eye className="h-3 w-3" /> Ver
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <RecordTrainingDialog
        open={recordDialog}
        onClose={() => setRecordDialog(false)}
        employeeId={employeeId}
        employeeName={employeeName}
        availableTrainings={trainings}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RhPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { canEditModule } = useAuth();
  const search = useSearch();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Employee state
  const [empSearch, setEmpSearch] = useState("");
  const [empStatusFilter, setEmpStatusFilter] = useState("all");
  const [empDeptFilter, setEmpDeptFilter] = useState("all");
  const [empDialog, setEmpDialog] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [profileEmpId, setProfileEmpId] = useState<number | null>(null);
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);

  // Deep-link: open employee drawer from URL query params
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const params = new URLSearchParams(search);
    const empId = params.get("employeeId");
    const tab = params.get("tab");
    if (empId) {
      deepLinkHandled.current = true;
      if (tab) setActiveTab(tab);
      setProfileEmpId(Number(empId));
    }
  }, [search]);

  // Department state
  const [deptDialog, setDeptDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);

  // Attendance state
  const [attendanceMonth, setAttendanceMonth] = useState(currentMonth);
  const [attendanceEmpId, setAttendanceEmpId] = useState<string>("");
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceLog | null>(null);
  const [deleteAttendance, setDeleteAttendance] = useState<AttendanceLog | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<string>("");

  const PAGE_SIZE = 20;
  const [empPage, setEmpPage] = useState(1);

  const empParams = useMemo(() => ({
    page: empPage,
    pageSize: PAGE_SIZE,
    ...(empSearch ? { search: empSearch } : {}),
    ...(empStatusFilter !== "all" ? { status: empStatusFilter as "active" | "inactive" } : {}),
    ...(empDeptFilter !== "all" ? { department: empDeptFilter } : {}),
  }), [empPage, empSearch, empStatusFilter, empDeptFilter]);

  useEffect(() => { setEmpPage(1); }, [empSearch, empStatusFilter, empDeptFilter]);

  const { data: empData, isLoading: empLoading } = useListEmployees(empParams);
  const employees = empData?.items ?? [];
  const { data: departments = [], isLoading: deptLoading } = useListDepartments();
  const { data: dashboard } = useGetRhDashboard();
  const { data: attendanceLogs = [], isLoading: attLoading } = useListAttendanceLogs(
    {
      employeeId: attendanceEmpId || undefined,
      month: attendanceMonth,
    },
    { query: { enabled: true } as any }
  );
  const { data: attendanceSummary } = useGetAttendanceSummary(
    {
      employeeId: attendanceEmpId ? Number(attendanceEmpId) : 0,
      month: attendanceMonth,
    },
    { query: { enabled: !!attendanceEmpId } as any }
  );

  // Training state
  const [trainingSearch, setTrainingSearch] = useState("");
  const [trainingTypeFilter, setTrainingTypeFilter] = useState("all");
  const [trainingDialog, setTrainingDialog] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [deleteTrainingItem, setDeleteTrainingItem] = useState<Training | null>(null);
  const [trainingEmpId, setTrainingEmpId] = useState<number | null>(null);
  const [matrixDept, setMatrixDept] = useState("all");

  const { data: trainings = [] } = useListTrainings({});
  const { data: matrix } = useGetTrainingMatrix({ dept: matrixDept !== "all" ? matrixDept : undefined });
  const { data: compliance = [] } = useGetTrainingCompliance();

  const filteredTrainings = useMemo(() => {
    let list = trainings;
    if (trainingTypeFilter !== "all") list = list.filter((t) => t.type === trainingTypeFilter);
    if (trainingSearch) {
      const q = trainingSearch.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [trainings, trainingTypeFilter, trainingSearch]);

  // Payroll state
  const [payrollMonth, setPayrollMonth] = useState(currentMonth);
  const [payrollStatusFilter, setPayrollStatusFilter] = useState("all");
  const [payrollEmpFilter, setPayrollEmpFilter] = useState("all");

  const payrollYear = parseInt(payrollMonth.split("-")[0]!);
  const payrollMonthNum = parseInt(payrollMonth.split("-")[1]!);

  const { data: payrollEntries = [], isLoading: payrollLoading } = useListPayrollEntries({
    periodYear: payrollYear,
    periodMonth: payrollMonthNum,
    ...(payrollStatusFilter !== "all" ? { status: payrollStatusFilter as "open" | "closed" | "paid" } : {}),
    ...(payrollEmpFilter !== "all" ? { employeeId: parseInt(payrollEmpFilter) } : {}),
  });

  const generatePayrollM = useGeneratePayroll();
  const updatePayrollStatusM = useUpdatePayrollStatus();

  const handleGeneratePayroll = () => {
    generatePayrollM.mutate(
      { data: { periodYear: payrollYear, periodMonth: payrollMonthNum } },
      {
        onSuccess: (data) => {
          toast({ title: `Folha gerada — ${data.length} funcionário(s)` });
          qc.invalidateQueries({ queryKey: getListPayrollEntriesQueryKey() });
        },
        onError: (e: any) => toast({ title: "Erro ao gerar folha", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const handlePayrollStatusChange = (entry: PayrollEntryWithEmployee, status: string) => {
    updatePayrollStatusM.mutate(
      { id: entry.id, data: { status: status as "open" | "closed" | "paid" } },
      {
        onSuccess: () => {
          toast({ title: "Status atualizado" });
          qc.invalidateQueries({ queryKey: getListPayrollEntriesQueryKey() });
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const payrollTotals = useMemo(() => {
    const filtered = payrollStatusFilter === "all"
      ? payrollEntries
      : payrollEntries.filter((e) => e.status === payrollStatusFilter);
    const totalBruto = filtered.reduce((s, e) => s + parseFloat(e.baseSalary), 0);
    const totalDescontos = filtered.reduce((s, e) => s + parseFloat(e.deductions), 0);
    const totalExtras = filtered.reduce((s, e) => s + parseFloat(e.extras), 0);
    const totalLiquido = filtered.reduce((s, e) => s + parseFloat(e.netSalary), 0);
    return { totalBruto, totalDescontos, totalExtras, totalLiquido, count: filtered.length };
  }, [payrollEntries, payrollStatusFilter]);

  const deleteEmpM = useDeleteEmployee();
  const deleteDeptM = useDeleteDepartment();
  const deleteAttM = useDeleteAttendanceLog();
  const deleteTrainingM = useDeleteTraining();

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees]
  );

  const filteredEmployees = employees;

  const attendanceByDate = useMemo(() => {
    const map: Record<string, AttendanceLog[]> = {};
    for (const log of attendanceLogs) {
      if (!map[log.date]) map[log.date] = [];
      map[log.date].push(log);
    }
    return map;
  }, [attendanceLogs]);

  const handleDeleteEmp = () => {
    if (!deleteEmp) return;
    deleteEmpM.mutate(
      { id: deleteEmp.id },
      {
        onSuccess: () => {
          toast({ title: "Funcionário desativado" });
          qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetRhDashboardQueryKey() });
          setDeleteEmp(null);
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteDept = () => {
    if (!deleteDept) return;
    deleteDeptM.mutate(
      { id: deleteDept.id },
      {
        onSuccess: () => {
          toast({ title: "Departamento excluído" });
          qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
          setDeleteDept(null);
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteAttendance = () => {
    if (!deleteAttendance) return;
    deleteAttM.mutate(
      { id: deleteAttendance.id },
      {
        onSuccess: () => {
          toast({ title: "Registro excluído" });
          qc.invalidateQueries({ queryKey: getListAttendanceLogsQueryKey() });
          setDeleteAttendance(null);
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteTraining = () => {
    if (!deleteTrainingItem) return;
    deleteTrainingM.mutate(
      { id: deleteTrainingItem.id },
      {
        onSuccess: () => {
          toast({ title: "Treinamento excluído" });
          qc.invalidateQueries({ queryKey: getListTrainingsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetTrainingMatrixQueryKey() });
          qc.invalidateQueries({ queryKey: getGetRhDashboardQueryKey() });
          setDeleteTrainingItem(null);
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const selectedEmployee = useMemo(
    () => employees.find((e) => String(e.id) === attendanceEmpId),
    [employees, attendanceEmpId]
  );

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Recursos Humanos"
          subtitle="Funcionários, departamentos e controle de ponto"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard">Resumo</TabsTrigger>
            <TabsTrigger value="employees">Funcionários</TabsTrigger>
            <TabsTrigger value="departments">Departamentos</TabsTrigger>
            <TabsTrigger value="attendance">Ponto</TabsTrigger>
            <TabsTrigger value="trainings">Treinamentos</TabsTrigger>
            <TabsTrigger value="matrix">Matriz</TabsTrigger>
            <TabsTrigger value="payroll">Folha de Pagamento</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD TAB ──────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Funcionários
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{dashboard?.totalEmployees ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold">{dashboard?.activeEmployees ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Inativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <UserX className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{dashboard?.inactiveEmployees ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Departamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <span className="text-2xl font-bold">{dashboard?.totalDepartments ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Ponto — {dashboard?.currentMonth ? fmtMonth(dashboard.currentMonth) : "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-green-50 p-4">
                      <div className="text-2xl font-bold text-green-700">
                        {dashboard?.attendanceThisMonth?.present ?? 0}
                      </div>
                      <div className="text-xs text-green-600 mt-1">Presentes</div>
                    </div>
                    <div className="rounded-lg bg-red-50 p-4">
                      <div className="text-2xl font-bold text-red-700">
                        {dashboard?.attendanceThisMonth?.absent ?? 0}
                      </div>
                      <div className="text-xs text-red-600 mt-1">Ausências</div>
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-4">
                      <div className="text-2xl font-bold text-yellow-700">
                        {dashboard?.attendanceThisMonth?.late ?? 0}
                      </div>
                      <div className="text-xs text-yellow-600 mt-1">Atrasos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Admissões Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {(!dashboard?.recentEmployees || dashboard.recentEmployees.length === 0) ? (
                    <p className="text-sm text-muted-foreground">Nenhum funcionário ativo.</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.recentEmployees.map((e) => (
                        <div key={e.id} className="flex items-center justify-between py-1.5 border-b last:border-b-0">
                          <div>
                            <div className="font-medium text-sm">{e.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {e.role}{e.department ? ` · ${e.department}` : ""}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtDate(e.hireDate)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Training KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Treinamentos Obrigatórios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{dashboard?.totalMandatoryTrainings ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Geral</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`h-5 w-5 ${(dashboard?.overallComplianceRate ?? 100) >= 80 ? "text-green-600" : "text-destructive"}`} />
                    <span className={`text-2xl font-bold ${(dashboard?.overallComplianceRate ?? 100) >= 80 ? "text-green-600" : "text-destructive"}`}>
                      {dashboard?.overallComplianceRate ?? 100}%
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Alertas de Vencimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-5 w-5 ${(dashboard?.trainingAlerts?.length ?? 0) > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
                    <span className={`text-2xl font-bold ${(dashboard?.trainingAlerts?.length ?? 0) > 0 ? "text-yellow-600" : ""}`}>
                      {dashboard?.trainingAlerts?.length ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {(dashboard?.trainingAlerts ?? []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Alertas de Treinamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Treinamento</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Vence em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(dashboard?.trainingAlerts ?? []).map((alert) => (
                        <TableRow key={alert.employeeTrainingId}>
                          <TableCell className="font-medium text-sm">{alert.employeeName}</TableCell>
                          <TableCell className="text-sm">{alert.trainingName}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trainingStatusColor(alert.status)}`}>
                              {trainingStatusLabel(alert.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {alert.expiresAt ? fmtDate(alert.expiresAt) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {compliance.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Compliance por Departamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Departamento</TableHead>
                        <TableHead className="text-right">Funcionários</TableHead>
                        <TableHead className="text-right">Conformes</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                        <TableHead className="w-36">Barra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compliance.map((c) => (
                        <TableRow key={c.department}>
                          <TableCell className="font-medium text-sm">{c.department}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{c.totalEmployees}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-green-600 font-semibold">{c.compliant}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums font-semibold">
                            <span className={c.complianceRate >= 80 ? "text-green-600" : c.complianceRate >= 60 ? "text-yellow-600" : "text-destructive"}>
                              {c.complianceRate}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${c.complianceRate >= 80 ? "bg-green-500" : c.complianceRate >= 60 ? "bg-yellow-400" : "bg-destructive"}`}
                                style={{ width: `${Math.min(c.complianceRate, 100)}%` }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── EMPLOYEES TAB ─────────────────────────────────────────────── */}
          <TabsContent value="employees" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-56"
                  placeholder="Buscar nome, CPF, cargo…"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                />
                <Select value={empStatusFilter} onValueChange={setEmpStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={empDeptFilter} onValueChange={setEmpDeptFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos depto.</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canEditModule('rh') && (
                <Button onClick={() => { setEditingEmp(null); setEmpDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Novo funcionário
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead>Salário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empLoading && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!empLoading && filteredEmployees.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          Nenhum funcionário encontrado
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredEmployees.map((e) => {
                      const lu = (e as any).linkedUser as { id: number; email: string; role: string; active: string } | null;
                      return (
                      <TableRow
                        key={e.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setProfileEmpId(e.id)}
                      >
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{e.cpf ?? "—"}</TableCell>
                        <TableCell>{e.role}</TableCell>
                        <TableCell>{e.department ?? "—"}</TableCell>
                        <TableCell>{fmtDate(e.hireDate)}</TableCell>
                        <TableCell>{fmtCurrency(e.salary)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {statusBadge(e.status)}
                            {lu && lu.active === "true" ? (
                              <Badge variant="outline" className="text-xs gap-1 w-fit">
                                <KeyRound className="h-3 w-3" />
                                {lu.role === "admin" ? "Admin" : lu.role === "manager" ? "Gerente" : "Colaborador"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem acesso</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setEditingEmp(e); setEmpDialog(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {e.status === "active" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Desativar" onClick={() => setDeleteEmp(e)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {(empData?.totalPages ?? 1) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">Página {empData?.page} de {empData?.totalPages} — {empData?.total} registros</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEmpPage((p) => Math.max(1, p - 1))} disabled={empPage <= 1}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setEmpPage((p) => p + 1)} disabled={empPage >= (empData?.totalPages ?? 1)}>Próxima</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DEPARTMENTS TAB ───────────────────────────────────────────── */}
          <TabsContent value="departments" className="space-y-4 mt-4">
            <div className="flex justify-end">
              {canEditModule('rh') && (
                <Button onClick={() => { setEditingDept(null); setDeptDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Novo departamento
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deptLoading && (
                <Card className="col-span-3">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </CardContent>
                </Card>
              )}
              {!deptLoading && departments.length === 0 && (
                <Card className="col-span-3">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    Nenhum departamento cadastrado
                  </CardContent>
                </Card>
              )}
              {departments.map((d) => (
                <Card key={d.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{d.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setEditingDept(d); setDeptDialog(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteDept(d)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {d.description && (
                      <p className="text-sm text-muted-foreground mb-3">{d.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{d.employeeCount} funcionário{d.employeeCount !== 1 ? "s" : ""} ativo{d.employeeCount !== 1 ? "s" : ""}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── ATTENDANCE TAB ────────────────────────────────────────────── */}
          <TabsContent value="attendance" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={attendanceEmpId || "all"} onValueChange={(v) => setAttendanceEmpId(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todos funcionários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos funcionários</SelectItem>
                    {activeEmployees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setAttendanceMonth((m) => prevMonth(m))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[140px] text-center capitalize">
                    {fmtMonth(attendanceMonth)}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setAttendanceMonth((m) => nextMonth(m))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={() => { setEditingAttendance(null); setQuickAddDate(""); setAttendanceDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Registrar ponto
              </Button>
            </div>

            {/* Summary when employee selected */}
            {attendanceEmpId && attendanceSummary && (
              <div className="grid grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold">{attendanceSummary.total}</div>
                    <div className="text-xs text-muted-foreground mt-1">Registros</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{attendanceSummary.present}</div>
                    <div className="text-xs text-muted-foreground mt-1">Presentes</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{attendanceSummary.absent}</div>
                    <div className="text-xs text-muted-foreground mt-1">Ausentes</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{attendanceSummary.late}</div>
                    <div className="text-xs text-muted-foreground mt-1">Atrasos</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      {!attendanceEmpId && <TableHead>Funcionário</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attLoading && (
                      <TableRow>
                        <TableCell colSpan={attendanceEmpId ? 6 : 7} className="text-center py-10 text-muted-foreground">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!attLoading && attendanceLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={attendanceEmpId ? 6 : 7} className="text-center py-10 text-muted-foreground">
                          Nenhum registro de ponto para este período
                        </TableCell>
                      </TableRow>
                    )}
                    {attendanceLogs.map((log) => {
                      const emp = employees.find((e) => String(e.id) === log.employeeId);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>{log.date}</TableCell>
                          {!attendanceEmpId && (
                            <TableCell>{emp?.name ?? `#${log.employeeId}`}</TableCell>
                          )}
                          <TableCell>{attendanceBadge(log.status)}</TableCell>
                          <TableCell className="text-muted-foreground">{log.checkIn ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{log.checkOut ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                            {log.notes ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => { setEditingAttendance(log); setAttendanceDialog(true); }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteAttendance(log)}
                              >
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

          {/* ── TRAININGS TAB ─────────────────────────────────────────────── */}
          <TabsContent value="trainings" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-56"
                  placeholder="Buscar treinamento…"
                  value={trainingSearch}
                  onChange={(e) => setTrainingSearch(e.target.value)}
                />
                <Select value={trainingTypeFilter} onValueChange={setTrainingTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="mandatory">Obrigatório</SelectItem>
                    <SelectItem value="optional">Opcional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { setEditingTraining(null); setTrainingDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo treinamento
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Cargo alvo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrainings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          Nenhum treinamento cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredTrainings.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <Badge variant={t.type === "mandatory" ? "default" : "secondary"} className="text-xs">
                            {t.type === "mandatory" ? "Obrigatório" : "Opcional"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.validityMonths ? `${t.validityMonths} meses` : "Sem vencimento"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.targetRole ?? "Todos"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {t.description ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setEditingTraining(t); setTrainingDialog(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTrainingItem(t)}
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

            {/* Per-employee training records */}
            {activeEmployees.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      Treinamentos por Funcionário
                    </CardTitle>
                    <Select
                      value={trainingEmpId ? String(trainingEmpId) : "none"}
                      onValueChange={(v) => setTrainingEmpId(v === "none" ? null : Number(v))}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Selecionar funcionário…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Selecionar —</SelectItem>
                        {activeEmployees.map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                {trainingEmpId && (
                  <CardContent>
                    <EmployeeTrainingPanel
                      employeeId={trainingEmpId}
                      employeeName={activeEmployees.find((e) => e.id === trainingEmpId)?.name ?? ""}
                      trainings={trainings}
                    />
                  </CardContent>
                )}
              </Card>
            )}
          </TabsContent>

          {/* ── MATRIX TAB ────────────────────────────────────────────────── */}
          <TabsContent value="matrix" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div>
                <Select value={matrixDept} onValueChange={setMatrixDept}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos departamentos</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /> Em dia</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-400" /> Vencendo</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" /> Vencido</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-200" /> Não realizado</div>
              </div>
            </div>

            {!matrix || matrix.trainings.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum treinamento obrigatório cadastrado.</p>
                  <p className="text-sm mt-1">Crie treinamentos do tipo "Obrigatório" para visualizar a matriz.</p>
                </CardContent>
              </Card>
            ) : !matrix || matrix.employees.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Nenhum funcionário ativo encontrado para este filtro.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium sticky left-0 bg-background z-10 min-w-[160px]">
                          Funcionário
                        </th>
                        {matrix.trainings.map((tr) => (
                          <th
                            key={tr.id}
                            className="p-2 text-center font-medium text-xs max-w-[90px] min-w-[80px]"
                            title={tr.name}
                          >
                            <div className="truncate max-w-[80px] mx-auto">{tr.name}</div>
                            {tr.validityMonths && (
                              <div className="text-muted-foreground font-normal">{tr.validityMonths}m</div>
                            )}
                          </th>
                        ))}
                        <th className="p-2 text-center font-medium text-xs">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.employees.map((emp) => {
                        const empCells = matrix.cells.filter((c) => c.employeeId === emp.id);
                        const applicableCells = empCells.filter((c) => c.status !== "not_applicable");
                        const doneCount = applicableCells.filter((c) => c.status === "up_to_date").length;
                        const total = applicableCells.length;
                        const score = total > 0 ? Math.round((doneCount / total) * 100) : 100;
                        return (
                          <tr key={emp.id} className="border-b hover:bg-muted/40">
                            <td className="p-3 sticky left-0 bg-background z-10">
                              <div className="font-medium truncate max-w-[150px]">{emp.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {emp.role}{emp.department ? ` · ${emp.department}` : ""}
                              </div>
                            </td>
                            {matrix.trainings.map((tr) => {
                              const cell = empCells.find((c) => c.trainingId === tr.id);
                              const status = cell?.status ?? "not_done";
                              return (
                                <td key={tr.id} className="p-2 text-center">
                                  <div
                                    className={`w-6 h-6 rounded mx-auto ${trainingMatrixCellClass(status)}`}
                                    title={`${emp.name} · ${tr.name}: ${trainingStatusLabel(status)}${cell?.expiresAt ? ` (vence ${fmtDate(cell.expiresAt)})` : ""}`}
                                  />
                                </td>
                              );
                            })}
                            <td className="p-2 text-center">
                              <span className={`text-xs font-semibold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-destructive"}`}>
                                {score}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── PAYROLL TAB ───────────────────────────────────────────────── */}
          <TabsContent value="payroll" className="space-y-4 mt-4">
            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setPayrollMonth(prevMonth(payrollMonth))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[130px] text-center">
                  {fmtMonth(payrollMonth)}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setPayrollMonth(nextMonth(payrollMonth))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Select value={payrollStatusFilter} onValueChange={setPayrollStatusFilter}>
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="open">Em aberto</SelectItem>
                    <SelectItem value="closed">Fechada</SelectItem>
                    <SelectItem value="paid">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGeneratePayroll}
                disabled={generatePayrollM.isPending}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${generatePayrollM.isPending ? "animate-spin" : ""}`} />
                {generatePayrollM.isPending ? "Gerando…" : "Gerar / Recalcular Folha"}
              </Button>
            </div>

            {/* Summary cards */}
            {payrollEntries.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Salário Bruto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xl font-bold tabular-nums">
                        {payrollTotals.totalBruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{payrollTotals.count} funcionário(s)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Descontos (faltas)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="text-xl font-bold tabular-nums text-destructive">
                        {payrollTotals.totalDescontos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Extras (horas)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-xl font-bold tabular-nums text-green-600">
                        {payrollTotals.totalExtras.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Salário Líquido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-xl font-bold tabular-nums text-primary">
                        {payrollTotals.totalLiquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Payroll table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Cargo / Depto</TableHead>
                      <TableHead className="text-right">Dias úteis</TableHead>
                      <TableHead className="text-right">Presentes</TableHead>
                      <TableHead className="text-right">Faltas</TableHead>
                      <TableHead className="text-right">H. Extras</TableHead>
                      <TableHead className="text-right">Salário Bruto</TableHead>
                      <TableHead className="text-right">Descontos</TableHead>
                      <TableHead className="text-right">Extras</TableHead>
                      <TableHead className="text-right">Salário Líquido</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollLoading && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!payrollLoading && payrollEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                          Nenhuma folha gerada para este período. Clique em "Gerar / Recalcular Folha".
                        </TableCell>
                      </TableRow>
                    )}
                    {payrollEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.employeeName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.employeeRole ?? "—"}
                          {entry.employeeDepartment ? ` · ${entry.employeeDepartment}` : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{entry.workingDays}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-green-600 font-medium">{entry.presentDays}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {entry.absentDays > 0
                            ? <span className="text-destructive font-medium">{entry.absentDays}</span>
                            : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {parseFloat(entry.overtimeHours) > 0
                            ? <span className="text-blue-600 font-medium">{parseFloat(entry.overtimeHours).toFixed(1)}h</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {parseFloat(entry.baseSalary).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {parseFloat(entry.deductions) > 0
                            ? <span className="text-destructive">{parseFloat(entry.deductions).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {parseFloat(entry.extras) > 0
                            ? <span className="text-green-600">{parseFloat(entry.extras).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-semibold">
                          {parseFloat(entry.netSalary).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={entry.status}
                            onValueChange={(v) => handlePayrollStatusChange(entry, v)}
                            disabled={updatePayrollStatusM.isPending}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Em aberto</SelectItem>
                              <SelectItem value="closed">Fechada</SelectItem>
                              <SelectItem value="paid">Paga</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {payrollEntries.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                Cálculo base: salário proporcional a dias úteis · horas extras acima de 8h/dia a 1/220 do salário mensal.
                Entradas com status "Fechada" ou "Paga" não são recalculadas.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}

      <EmployeeDialog
        open={empDialog}
        onClose={() => { setEmpDialog(false); setEditingEmp(null); }}
        editing={editingEmp}
        departments={departments}
      />

      <EmployeeDrawer
        employeeId={profileEmpId}
        onClose={() => setProfileEmpId(null)}
        onEdit={(emp) => { setEditingEmp(emp); setEmpDialog(true); }}
      />

      <DepartmentDialog
        open={deptDialog}
        onClose={() => { setDeptDialog(false); setEditingDept(null); }}
        editing={editingDept}
      />

      <AttendanceDialog
        open={attendanceDialog}
        onClose={() => { setAttendanceDialog(false); setEditingAttendance(null); setQuickAddDate(""); }}
        editing={editingAttendance}
        defaultEmployeeId={attendanceEmpId || undefined}
        defaultDate={quickAddDate || undefined}
        employees={activeEmployees}
      />

      {/* Delete employee alert */}
      <AlertDialog open={!!deleteEmp} onOpenChange={(v) => !v && setDeleteEmp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteEmp?.name} será marcado como inativo. Esta ação pode ser revertida editando o cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmp}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete department alert */}
      <AlertDialog open={!!deleteDept} onOpenChange={(v) => !v && setDeleteDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O departamento "{deleteDept?.name}" será permanentemente excluído. Os funcionários vinculados não serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDept}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete attendance alert */}
      <AlertDialog open={!!deleteAttendance} onOpenChange={(v) => !v && setDeleteAttendance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro de ponto?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro do dia {deleteAttendance?.date} será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAttendance}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Training dialog */}
      <TrainingDialog
        open={trainingDialog}
        onClose={() => { setTrainingDialog(false); setEditingTraining(null); }}
        editing={editingTraining}
      />

      {/* Delete training alert */}
      <AlertDialog open={!!deleteTrainingItem} onOpenChange={(v) => !v && setDeleteTrainingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treinamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O treinamento "{deleteTrainingItem?.name}" será permanentemente excluído, incluindo todos os registros de realização vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTraining}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
