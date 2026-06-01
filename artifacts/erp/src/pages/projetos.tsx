import { useState, useMemo, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useListProjectTasks,
  useCreateProjectTask,
  useUpdateProjectTask,
  useUpdateProjectTaskStatus,
  useDeleteProjectTask,
  useGetMyTasks,
  useGetProjectsDashboard,
  getListProjectsQueryKey,
  getListProjectTasksQueryKey,
  getGetMyTasksQueryKey,
  getGetProjectsDashboardQueryKey,
  useListClients,
  useListEmployees,
} from "@workspace/api-client-react";
import type { Project, ProjectTask } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  ListTodo,
  Loader2,
  User,
  CalendarDays,
  ArrowLeft,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function isOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-blue-100 text-blue-800" },
  active: { label: "Ativo", color: "bg-green-100 text-green-800" },
  on_hold: { label: "Em Espera", color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Concluído", color: "bg-gray-100 text-gray-700" },
};

const PRIORITY_META: Record<string, { label: string; color: string; icon: string }> = {
  low: { label: "Baixa", color: "text-gray-500", icon: "↓" },
  medium: { label: "Média", color: "text-blue-500", icon: "→" },
  high: { label: "Alta", color: "text-orange-500", icon: "↑" },
  urgent: { label: "Urgente", color: "text-red-600", icon: "⚡" },
};

function ProjectStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? { label: priority, color: "text-gray-500", icon: "" };
  return (
    <span className={`text-xs font-semibold ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

// ─── Project Form Dialog ──────────────────────────────────────────────────────

const projectSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  status: z.enum(["planning", "active", "on_hold", "completed"]).default("planning"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
type ProjectForm = z.infer<typeof projectSchema>;

function ProjectDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Project | null;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createM = useCreateProject();
  const updateM = useUpdateProject();
  const { data: clients = [] } = useListClients({});

  const form = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "", clientId: "", status: "planning", startDate: "", endDate: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? "",
        description: editing?.description ?? "",
        clientId: editing?.clientId ? String(editing.clientId) : "",
        status: (editing?.status as any) ?? "planning",
        startDate: editing?.startDate ? new Date(editing.startDate).toISOString().slice(0, 10) : "",
        endDate: editing?.endDate ? new Date(editing.endDate).toISOString().slice(0, 10) : "",
      });
    }
  }, [open, editing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetProjectsDashboardQueryKey() });
  };

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      clientId: data.clientId ? parseInt(data.clientId, 10) : undefined,
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
      endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
    };

    if (editing) {
      updateM.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => { toast({ title: "Projeto atualizado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    } else {
      createM.mutate(
        { data: payload },
        {
          onSuccess: () => { toast({ title: "Projeto criado" }); invalidate(); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input {...form.register("name")} placeholder="Nome do projeto" />
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
              <Label>Cliente</Label>
              <Controller
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                      <SelectItem value="planning">Planejamento</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="on_hold">Em Espera</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Início</Label>
              <Input {...form.register("startDate")} type="date" />
            </div>
            <div className="space-y-1">
              <Label>Prazo</Label>
              <Input {...form.register("endDate")} type="date" />
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

// ─── Task Form Dialog ─────────────────────────────────────────────────────────

const taskSchema = z.object({
  projectId: z.string().min(1, "Obrigatório"),
  title: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  dueDate: z.string().optional(),
});
type TaskForm = z.infer<typeof taskSchema>;

function TaskDialog({
  open,
  onClose,
  editing,
  defaultProjectId,
  defaultStatus,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProjectTask | null;
  defaultProjectId?: number;
  defaultStatus?: string;
  projects: Project[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createM = useCreateProjectTask();
  const updateM = useUpdateProjectTask();
  const { data: employees = [] } = useListEmployees({});
  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);

  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      projectId: "",
      title: "",
      description: "",
      assigneeId: "",
      priority: "medium",
      status: "todo",
      dueDate: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        projectId: editing ? String(editing.projectId) : (defaultProjectId ? String(defaultProjectId) : ""),
        title: editing?.title ?? "",
        description: editing?.description ?? "",
        assigneeId: editing?.assigneeId ?? "",
        priority: (editing?.priority as any) ?? "medium",
        status: (editing?.status as any) ?? (defaultStatus as any) ?? "todo",
        dueDate: editing?.dueDate ? new Date(editing.dueDate).toISOString().slice(0, 10) : "",
      });
    }
  }, [open, editing, defaultProjectId, defaultStatus]);

  const invalidate = (projectId?: number) => {
    qc.invalidateQueries({ queryKey: getListProjectTasksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMyTasksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetProjectsDashboardQueryKey() });
    if (projectId) qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  };

  const onSubmit = form.handleSubmit((data) => {
    const projId = parseInt(data.projectId, 10);
    const emp = activeEmployees.find((e) => String(e.id) === data.assigneeId);
    const payload = {
      projectId: projId,
      title: data.title,
      description: data.description || undefined,
      assigneeId: data.assigneeId || undefined,
      assigneeName: emp ? emp.name : undefined,
      priority: data.priority,
      status: data.status,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
    };

    if (editing) {
      updateM.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => { toast({ title: "Tarefa atualizada" }); invalidate(projId); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    } else {
      createM.mutate(
        { data: payload },
        {
          onSuccess: () => { toast({ title: "Tarefa criada" }); invalidate(projId); onClose(); },
          onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
        }
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Projeto *</Label>
            <Controller
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar projeto…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Selecionar —</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.projectId && (
              <p className="text-xs text-destructive">{form.formState.errors.projectId.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Título *</Label>
            <Input {...form.register("title")} placeholder="Título da tarefa" />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea {...form.register("description")} rows={2} placeholder="Detalhes opcionais" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Controller
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {activeEmployees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">↓ Baixa</SelectItem>
                      <SelectItem value="medium">→ Média</SelectItem>
                      <SelectItem value="high">↑ Alta</SelectItem>
                      <SelectItem value="urgent">⚡ Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
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
                      <SelectItem value="todo">A fazer</SelectItem>
                      <SelectItem value="in_progress">Em andamento</SelectItem>
                      <SelectItem value="done">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Prazo</Label>
              <Input {...form.register("dueDate")} type="date" />
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

// ─── Kanban Board ─────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: "todo", label: "A Fazer", color: "border-gray-200 bg-gray-50" },
  { key: "in_progress", label: "Em Andamento", color: "border-blue-200 bg-blue-50" },
  { key: "done", label: "Concluídas", color: "border-green-200 bg-green-50" },
];

function KanbanCard({
  task,
  onEdit,
  onDelete,
  onDragStart,
}: {
  task: ProjectTask;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent, task: ProjectTask) => void;
}) {
  const overdue = isOverdue(task.dueDate) && task.status !== "done";
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      className="bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing group select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" /> Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between mt-2 gap-2">
        <PriorityBadge priority={task.priority} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.assigneeName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assigneeName.split(" ")[0]}
            </span>
          )}
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${overdue ? "text-red-600 font-medium" : ""}`}>
              <CalendarDays className="h-3 w-3" />
              {fmtDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({
  projectId,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  projectId: number;
  tasks: ProjectTask[];
  onAddTask: (status: string) => void;
  onEditTask: (task: ProjectTask) => void;
  onDeleteTask: (task: ProjectTask) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateStatusM = useUpdateProjectTaskStatus();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const draggingTaskRef = useRef<ProjectTask | null>(null);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, ProjectTask[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tasks]);

  const handleDragStart = (e: React.DragEvent, task: ProjectTask) => {
    draggingTaskRef.current = task;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const task = draggingTaskRef.current;
    if (!task || task.status === status) {
      setDragOver(null);
      return;
    }

    updateStatusM.mutate(
      { id: task.id, data: { status: status as any } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListProjectTasksQueryKey() });
          qc.invalidateQueries({ queryKey: getGetProjectsDashboardQueryKey() });
          qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        },
        onError: (e: any) => toast({ title: "Erro ao mover tarefa", description: e?.message, variant: "destructive" }),
      }
    );
    draggingTaskRef.current = null;
    setDragOver(null);
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          className={`rounded-xl border-2 ${col.color} p-3 min-h-[400px] transition-all ${dragOver === col.key ? "ring-2 ring-primary ring-offset-1" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, col.key)}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">{col.label}</span>
            <Badge variant="secondary" className="text-xs">{tasksByStatus[col.key].length}</Badge>
          </div>
          <div className="space-y-2">
            {tasksByStatus[col.key].map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task)}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            className="w-full mt-3 h-8 text-muted-foreground text-xs justify-start"
            onClick={() => onAddTask(col.key)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar tarefa
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Project Detail View ──────────────────────────────────────────────────────

function ProjectDetail({
  project,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: allProjects = [] } = useListProjects({});
  const { data: tasks = [], isLoading } = useListProjectTasks(
    { projectId: project.id },
    { query: { enabled: true } as any }
  );
  const deleteTaskM = useDeleteProjectTask();

  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [defaultStatus, setDefaultStatus] = useState("todo");
  const [deleteTask, setDeleteTask] = useState<ProjectTask | null>(null);

  const completion = project.taskCount > 0
    ? Math.round((project.completedCount / project.taskCount) * 100)
    : 0;

  const handleAddTask = (status: string) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setTaskDialog(true);
  };

  const handleDeleteTask = () => {
    if (!deleteTask) return;
    deleteTaskM.mutate(
      { id: deleteTask.id },
      {
        onSuccess: () => {
          toast({ title: "Tarefa excluída" });
          qc.invalidateQueries({ queryKey: getListProjectTasksQueryKey() });
          qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetProjectsDashboardQueryKey() });
          setDeleteTask(null);
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{project.name}</h2>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingTask(null); setDefaultStatus("todo"); setTaskDialog(true); }}
        >
          <Plus className="h-4 w-4 mr-2" /> Nova tarefa
        </Button>
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Progresso</div>
            <div className="flex items-center gap-2">
              <Progress value={completion} className="flex-1 h-2" />
              <span className="text-sm font-semibold">{completion}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Tarefas</div>
            <div className="text-xl font-bold">{project.taskCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Concluídas</div>
            <div className="text-xl font-bold text-green-600">{project.completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Prazo</div>
            <div className={`text-sm font-medium ${isOverdue(project.endDate) && project.status !== "completed" ? "text-red-600" : ""}`}>
              {fmtDate(project.endDate)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando…
        </div>
      ) : (
        <KanbanBoard
          projectId={project.id}
          tasks={tasks}
          onAddTask={handleAddTask}
          onEditTask={(t) => { setEditingTask(t); setTaskDialog(true); }}
          onDeleteTask={setDeleteTask}
        />
      )}

      <TaskDialog
        open={taskDialog}
        onClose={() => { setTaskDialog(false); setEditingTask(null); }}
        editing={editingTask}
        defaultProjectId={project.id}
        defaultStatus={defaultStatus}
        projects={allProjects}
      />

      <AlertDialog open={!!deleteTask} onOpenChange={(v) => !v && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTask?.title}" será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjetosPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Projects
  const [projSearch, setProjSearch] = useState("");
  const [projStatusFilter, setProjStatusFilter] = useState("all");
  const [projDialog, setProjDialog] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [deleteProj, setDeleteProj] = useState<Project | null>(null);

  // Tasks (for my-tasks tab)
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [deleteTask, setDeleteTask] = useState<ProjectTask | null>(null);

  const { data: projects = [], isLoading: projLoading } = useListProjects({});
  const { data: myTasks = [], isLoading: myTasksLoading } = useGetMyTasks();
  const { data: dashboard } = useGetProjectsDashboard();

  const deleteProjM = useDeleteProject();
  const deleteTaskM = useDeleteProjectTask();

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (projStatusFilter !== "all") list = list.filter((p) => p.status === projStatusFilter);
    if (projSearch) {
      const q = projSearch.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.clientName ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [projects, projStatusFilter, projSearch]);

  const myTasksByProject = useMemo(() => {
    const map: Record<string, { projectName: string; tasks: ProjectTask[] }> = {};
    for (const t of myTasks) {
      const key = String(t.projectId);
      if (!map[key]) map[key] = { projectName: t.projectName ?? `Projeto #${t.projectId}`, tasks: [] };
      map[key].tasks.push(t);
    }
    return map;
  }, [myTasks]);

  const handleDeleteProj = () => {
    if (!deleteProj) return;
    deleteProjM.mutate(
      { id: deleteProj.id },
      {
        onSuccess: () => {
          toast({ title: "Projeto excluído" });
          qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetProjectsDashboardQueryKey() });
          setDeleteProj(null);
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteTask = () => {
    if (!deleteTask) return;
    deleteTaskM.mutate(
      { id: deleteTask.id },
      {
        onSuccess: () => {
          toast({ title: "Tarefa excluída" });
          qc.invalidateQueries({ queryKey: getGetMyTasksQueryKey() });
          qc.invalidateQueries({ queryKey: getGetProjectsDashboardQueryKey() });
          setDeleteTask(null);
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
      }
    );
  };

  // If viewing a project detail (kanban), render that instead of tabs
  if (selectedProject) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto">
          <ProjectDetail
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <PageHeader
          title="Projetos"
          subtitle="Acompanhe projetos, tarefas e prazos"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Resumo</TabsTrigger>
            <TabsTrigger value="projects">Projetos</TabsTrigger>
            <TabsTrigger value="my-tasks">Minhas Tarefas</TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Projetos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{dashboard?.totalProjects ?? 0}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {dashboard?.activeProjects ?? 0} ativos · {dashboard?.completedProjects ?? 0} concluídos
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Minhas Pendências</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-blue-600" />
                    <span className="text-2xl font-bold">{dashboard?.myPendingTasks ?? 0}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">tarefas a concluir</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Atrasadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-2xl font-bold text-red-600">{dashboard?.overdueTasksCount ?? 0}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">tarefas vencidas</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projetos Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                {!dashboard?.recentProjects || dashboard.recentProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhum projeto ativo. <Button variant="link" className="p-0 h-auto text-sm" onClick={() => setActiveTab("projects")}>Criar agora →</Button>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentProjects.map((p) => {
                      const pct = p.taskCount > 0 ? Math.round((p.completedCount / p.taskCount) * 100) : 0;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-4 py-2 cursor-pointer hover:bg-muted/40 rounded-lg px-2 -mx-2"
                          onClick={() => { setSelectedProject(p); }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{p.name}</span>
                              {p.clientName && <span className="text-xs text-muted-foreground">· {p.clientName}</span>}
                            </div>
                            <Progress value={pct} className="h-1.5 mt-1.5" />
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold">{pct}%</div>
                            <div className="text-xs text-muted-foreground">{p.completedCount}/{p.taskCount}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PROJECTS LIST ─────────────────────────────────────────────── */}
          <TabsContent value="projects" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-52"
                  placeholder="Buscar projetos…"
                  value={projSearch}
                  onChange={(e) => setProjSearch(e.target.value)}
                />
                <Select value={projStatusFilter} onValueChange={setProjStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="planning">Planejamento</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="on_hold">Em Espera</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { setEditingProj(null); setProjDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo projeto
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projLoading && (
                <div className="col-span-3 text-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando…
                </div>
              )}
              {!projLoading && filteredProjects.length === 0 && (
                <div className="col-span-3 text-center py-12 text-muted-foreground">
                  Nenhum projeto encontrado
                </div>
              )}
              {filteredProjects.map((p) => {
                const pct = p.taskCount > 0 ? Math.round((p.completedCount / p.taskCount) * 100) : 0;
                const overdue = isOverdue(p.endDate) && p.status !== "completed";
                return (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => setSelectedProject(p)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{p.name}</CardTitle>
                          {p.clientName && (
                            <p className="text-xs text-muted-foreground mt-0.5">{p.clientName}</p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); setEditingProj(p); setProjDialog(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteProj(p); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {p.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <ProjectStatusBadge status={p.status} />
                        <span className="text-xs text-muted-foreground">
                          {p.completedCount}/{p.taskCount} tarefas
                        </span>
                      </div>
                      <div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {fmtDate(p.startDate)}
                        </span>
                        <span className={`flex items-center gap-1 ${overdue ? "text-red-600 font-medium" : ""}`}>
                          {overdue && <AlertCircle className="h-3 w-3" />}
                          {fmtDate(p.endDate)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── MY TASKS ─────────────────────────────────────────────────── */}
          <TabsContent value="my-tasks" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Tarefas atribuídas a você em todos os projetos
              </p>
              <Button size="sm" onClick={() => { setEditingTask(null); setTaskDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nova tarefa
              </Button>
            </div>

            {myTasksLoading && (
              <div className="text-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando…
              </div>
            )}

            {!myTasksLoading && myTasks.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                  <p className="text-sm font-medium">Tudo em dia!</p>
                  <p className="text-xs text-muted-foreground mt-1">Você não tem tarefas atribuídas.</p>
                </CardContent>
              </Card>
            )}

            {Object.entries(myTasksByProject).map(([projectId, { projectName, tasks }]) => (
              <div key={projectId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{projectName}</span>
                  <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarefa</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Prazo</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((t) => {
                          const overdue = isOverdue(t.dueDate) && t.status !== "done";
                          return (
                            <TableRow key={t.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium text-sm">{t.title}</div>
                                  {t.description && (
                                    <div className="text-xs text-muted-foreground truncate max-w-[240px]">{t.description}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                              <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                              <TableCell className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                {t.dueDate ? (
                                  <span className="flex items-center gap-1">
                                    {overdue && <AlertCircle className="h-3 w-3" />}
                                    {fmtDate(t.dueDate)}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => { setEditingTask(t); setTaskDialog(true); }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteTask(t)}
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
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      <ProjectDialog
        open={projDialog}
        onClose={() => { setProjDialog(false); setEditingProj(null); }}
        editing={editingProj}
      />

      <TaskDialog
        open={taskDialog}
        onClose={() => { setTaskDialog(false); setEditingTask(null); }}
        editing={editingTask}
        projects={projects}
      />

      <AlertDialog open={!!deleteProj} onOpenChange={(v) => !v && setDeleteProj(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto "{deleteProj?.name}" e todas as suas tarefas serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProj}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTask} onOpenChange={(v) => !v && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTask?.title}" será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
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
