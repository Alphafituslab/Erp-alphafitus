import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout";
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
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getListAttendanceLogsQueryKey,
  getGetRhDashboardQueryKey,
} from "@workspace/api-client-react";
import type {
  Employee,
  EmployeeWithAttendance,
  Department,
  AttendanceLog,
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
} from "lucide-react";
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
});
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
      name: "",
      cpf: "",
      email: "",
      phone: "",
      role: "",
      department: "",
      hireDate: "",
      salary: "",
      status: "active",
    },
  });

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
        });
      } else {
        form.reset({
          name: "",
          cpf: "",
          email: "",
          phone: "",
          role: "",
          department: "",
          hireDate: "",
          salary: "",
          status: "active",
        });
      }
    }
  }, [open, editing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRhDashboardQueryKey() });
  };

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      ...data,
      cpf: data.cpf || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      department: data.department || undefined,
      hireDate: data.hireDate ? new Date(data.hireDate).toISOString() : undefined,
      salary: data.salary || undefined,
    };

    if (editing) {
      updateM.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Funcionário atualizado" });
            invalidate();
            onClose();
          },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    } else {
      createM.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Funcionário cadastrado" });
            invalidate();
            onClose();
          },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
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
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Employee Profile Dialog ──────────────────────────────────────────────────

function EmployeeProfileDialog({
  employeeId,
  onClose,
}: {
  employeeId: number | null;
  onClose: () => void;
}) {
  const { data: emp } = useGetEmployee(employeeId ?? 0, {
    query: { enabled: employeeId !== null } as any,
  });
  const profile = emp as EmployeeWithAttendance | undefined;

  if (!employeeId) return null;

  return (
    <Dialog open={employeeId !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfil — {profile?.name ?? "…"}</DialogTitle>
        </DialogHeader>
        {profile && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">CPF:</span> {profile.cpf ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Cargo:</span> {profile.role}
              </div>
              <div>
                <span className="text-muted-foreground">Depto:</span>{" "}
                {profile.department ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Admissão:</span>{" "}
                {fmtDate(profile.hireDate)}
              </div>
              <div>
                <span className="text-muted-foreground">Salário:</span>{" "}
                {fmtCurrency(profile.salary)}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                {statusBadge(profile.status)}
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span> {profile.email ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Telefone:</span> {profile.phone ?? "—"}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Histórico de Ponto (últimos 30)</h3>
              {!profile.attendance || profile.attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro de ponto.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.attendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>{a.checkIn ?? "—"}</TableCell>
                        <TableCell>{a.checkOut ?? "—"}</TableCell>
                        <TableCell>{attendanceBadge(a.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RhPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Employee state
  const [empSearch, setEmpSearch] = useState("");
  const [empStatusFilter, setEmpStatusFilter] = useState("all");
  const [empDeptFilter, setEmpDeptFilter] = useState("all");
  const [empDialog, setEmpDialog] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [profileEmpId, setProfileEmpId] = useState<number | null>(null);
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);

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

  const { data: employees = [], isLoading: empLoading } = useListEmployees({});
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

  const deleteEmpM = useDeleteEmployee();
  const deleteDeptM = useDeleteDepartment();
  const deleteAttM = useDeleteAttendanceLog();

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (empStatusFilter !== "all") list = list.filter((e) => e.status === empStatusFilter);
    if (empDeptFilter !== "all") list = list.filter((e) => e.department === empDeptFilter);
    if (empSearch) {
      const q = empSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.cpf ?? "").includes(q) ||
          (e.email ?? "").toLowerCase().includes(q) ||
          (e.role ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, empStatusFilter, empDeptFilter, empSearch]);

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
          <TabsList>
            <TabsTrigger value="dashboard">Resumo</TabsTrigger>
            <TabsTrigger value="employees">Funcionários</TabsTrigger>
            <TabsTrigger value="departments">Departamentos</TabsTrigger>
            <TabsTrigger value="attendance">Ponto</TabsTrigger>
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
              <Button onClick={() => { setEditingEmp(null); setEmpDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo funcionário
              </Button>
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
                    {filteredEmployees.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{e.cpf ?? "—"}</TableCell>
                        <TableCell>{e.role}</TableCell>
                        <TableCell>{e.department ?? "—"}</TableCell>
                        <TableCell>{fmtDate(e.hireDate)}</TableCell>
                        <TableCell>{fmtCurrency(e.salary)}</TableCell>
                        <TableCell>{statusBadge(e.status)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Ver perfil"
                              onClick={() => setProfileEmpId(e.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Editar"
                              onClick={() => { setEditingEmp(e); setEmpDialog(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {e.status === "active" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Desativar"
                                onClick={() => setDeleteEmp(e)}
                              >
                                <Trash2 className="h-4 w-4" />
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

          {/* ── DEPARTMENTS TAB ───────────────────────────────────────────── */}
          <TabsContent value="departments" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingDept(null); setDeptDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo departamento
              </Button>
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
        </Tabs>
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}

      <EmployeeDialog
        open={empDialog}
        onClose={() => { setEmpDialog(false); setEditingEmp(null); }}
        editing={editingEmp}
        departments={departments}
      />

      <EmployeeProfileDialog
        employeeId={profileEmpId}
        onClose={() => setProfileEmpId(null)}
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
    </AppLayout>
  );
}
