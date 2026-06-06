import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/contexts/auth";
import { Redirect, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  UserCheck,
  UserX,
  Shield,
  Users,
  Database,
  Download,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Link2,
  Clock,
  CalendarClock,
  XCircle,
  Cloud,
  Lock,
  LockOpen,
  Mail,
  Server,
  Eye,
  EyeOff,
  AlertTriangle,
  UploadCloud,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import {
  useListUsuarios,
  useCreateUsuario,
  useUpdateUsuario,
  useDeleteUsuario,
  getListUsuariosQueryKey,
  useGenerateBackup,
  useListBackupLogs,
  getListBackupLogsQueryKey,
  useGetUserModules,
  useSetUserModules,
  getGetUserModulesQueryKey,
  useGetBackupSchedule,
  useUpdateBackupSchedule,
  getGetBackupScheduleQueryKey,
  useGetBackupConfig,
  useGetSmtpStatus,
  useUpdateSmtpConfig,
  useTestSmtpConfig,
  useDeleteSmtpConfig,
  getGetSmtpStatusQueryKey,
  useRestoreBackup,
} from "@workspace/api-client-react";
import type { UserItem, BackupLog, BackupSchedule } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  employee: "Colaborador",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  employee: "bg-gray-100 text-gray-700 border-gray-200",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[role] ?? ROLE_COLORS.employee}`}>
      {role === "admin" && <Shield className="h-3 w-3" />}
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ── Create Dialog ─────────────────────────────────────────────────────────────

const SECTOR_LABELS_UI: Record<string, string> = {
  vendas: "Vendas",
  financeiro: "Financeiro",
  producao: "Produção",
  separacao: "Separação",
  faturamento: "Faturamento",
  logistica: "Logística",
};

function CreateUsuarioDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "employee">("employee");
  const [sector, setSector] = useState<string>("");
  const { toast } = useToast();

  const { mutate: create, isPending } = useCreateUsuario({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Colaborador criado!", description: `${data.user.name} foi adicionado ao sistema.` });
        setOpen(false);
        resetForm();
        onSuccess();
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao criar colaborador.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      },
    },
  });

  function resetForm() {
    setName(""); setEmail(""); setPassword(""); setRole("employee"); setSector("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create({ data: { name, email, password, role, sector: sector || null } as any });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar colaborador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="c-name">Nome completo</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: João Silva" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-email">E-mail (usado no login)</Label>
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="joao@empresa.com.br" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-pass">Senha inicial</Label>
            <Input id="c-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mín. 6 caracteres" minLength={6} />
          </div>
          <div className="space-y-1">
            <Label>Perfil de acesso</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Colaborador — acesso básico</SelectItem>
                <SelectItem value="manager">Gerente — pode configurar metas e ver relatórios</SelectItem>
                <SelectItem value="admin">Administrador — acesso total</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Setor <span className="text-muted-foreground">(opcional — para colaboradores de Vendas)</span></Label>
            <Select value={sector || "__none__"} onValueChange={(v) => setSector(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem setor específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem setor</SelectItem>
                {Object.entries(SECTOR_LABELS_UI).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Dialog ───────────────────────────────────────────────────────────────

function EditUsuarioDialog({ user, currentUserId, onSuccess }: { user: UserItem; currentUserId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "employee">(user.role as "admin" | "manager" | "employee");
  const [sector, setSector] = useState<string>((user as any).sector ?? "");
  const [active, setActive] = useState(user.active);
  const { toast } = useToast();

  const { mutate: update, isPending } = useUpdateUsuario({
    mutation: {
      onSuccess: () => {
        toast({ title: "Colaborador atualizado!" });
        setOpen(false);
        onSuccess();
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao atualizar.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      },
    },
  });

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) { setName(user.name); setEmail(user.email); setPassword(""); setRole(user.role as typeof role); setSector((user as any).sector ?? ""); setActive(user.active); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = { name, email, role, active, sector: sector || null };
    if (password) payload.password = password;
    update({ id: user.id, data: payload as any });
  }

  const isSelf = user.id === currentUserId;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar colaborador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="e-name">Nome completo</Label>
            <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="e-email">E-mail</Label>
            <Input id="e-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="e-pass">Nova senha <span className="text-muted-foreground">(deixe em branco para manter)</span></Label>
            <Input id="e-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 6 caracteres" minLength={6} />
          </div>
          <div className="space-y-1">
            <Label>Perfil de acesso</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)} disabled={isSelf}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Colaborador — acesso básico</SelectItem>
                <SelectItem value="manager">Gerente — pode configurar metas e ver relatórios</SelectItem>
                <SelectItem value="admin">Administrador — acesso total</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && <p className="text-xs text-muted-foreground">Você não pode alterar seu próprio perfil.</p>}
          </div>
          <div className="space-y-1">
            <Label>Setor <span className="text-muted-foreground">(para fluxo de Vendas)</span></Label>
            <Select value={sector || "__none__"} onValueChange={(v) => setSector(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem setor específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem setor</SelectItem>
                {Object.entries(SECTOR_LABELS_UI).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Conta ativa</p>
              <p className="text-xs text-muted-foreground">Colaboradores inativos não conseguem fazer login.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} disabled={isSelf} />
          </div>
          {isSelf && <p className="text-xs text-muted-foreground">Você não pode desativar sua própria conta.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Module Permissions Dialog ─────────────────────────────────────────────────

const MODULES_LIST = [
  { key: "relatorios", label: "Relatórios", group: "Painel" },
  { key: "dashboard", label: "Dashboard", group: "Painel" },
  { key: "vendas", label: "Vendas", group: "Operações" },
  { key: "estoque", label: "Estoque", group: "Operações" },
  { key: "compras", label: "Compras", group: "Operações" },
  { key: "producao", label: "Produção", group: "Operações" },
  { key: "aps", label: "APS / Gantt", group: "Operações" },
  { key: "qualidade", label: "Qualidade", group: "Operações" },
  { key: "rastreabilidade", label: "Rastreabilidade", group: "Operações" },
  { key: "financeiro", label: "Financeiro", group: "Gestão" },
  { key: "fiscal", label: "Fiscal", group: "Gestão" },
  { key: "rh", label: "RH", group: "Gestão" },
  { key: "projetos", label: "Projetos", group: "Gestão" },
];

function PermissoesDialog({ targetUser }: { targetUser: UserItem }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  type ModuleState = { canAccess: boolean; canEdit: boolean };
  const [perms, setPerms] = useState<Record<string, ModuleState>>({});

  const { data: modulesData, isLoading: modulesLoading } = useGetUserModules(targetUser.id, {
    query: {
      queryKey: getGetUserModulesQueryKey(targetUser.id),
      enabled: open,
    },
  });

  // Sync local state whenever server data arrives
  const [syncedData, setSyncedData] = useState<typeof modulesData>(undefined);
  if (modulesData !== syncedData) {
    setSyncedData(modulesData);
    if (modulesData) {
      const initial: Record<string, ModuleState> = {};
      MODULES_LIST.forEach((m) => { initial[m.key] = { canAccess: false, canEdit: false }; });
      modulesData.modules.forEach((m) => { initial[m.module] = { canAccess: true, canEdit: m.canEdit }; });
      setPerms(initial);
    }
  }

  const { mutate: saveModules, isPending: isSaving } = useSetUserModules({
    mutation: {
      onSuccess: () => {
        toast({ title: "Permissões salvas!", description: `Permissões de ${targetUser.name} atualizadas.` });
        setOpen(false);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao salvar.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      },
    },
  });

  function handleSave() {
    const modules = Object.entries(perms)
      .filter(([, v]) => v.canAccess)
      .map(([module, v]) => ({ module, canEdit: v.canEdit }));
    saveModules({ id: targetUser.id, data: { modules } });
  }

  function toggleAccess(key: string, val: boolean) {
    setPerms((prev) => ({
      ...prev,
      [key]: { canAccess: val, canEdit: val ? (prev[key]?.canEdit ?? false) : false },
    }));
  }

  function toggleEdit(key: string, val: boolean) {
    setPerms((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { canAccess: true }), canEdit: val } }));
  }

  const isFullAccess = targetUser.role === "admin" || targetUser.role === "manager";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" title="Gerenciar permissões">
          <ShieldCheck className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            Permissões — {targetUser.name}
          </DialogTitle>
        </DialogHeader>

        {isFullAccess ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              Perfil <strong>{targetUser.role === "admin" ? "Administrador" : "Gerente"}</strong> tem acesso total a todos os módulos por padrão.
              Permissões individuais não se aplicam a este perfil.
            </span>
          </div>
        ) : modulesLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando permissões…
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              <strong>Acesso:</strong> o colaborador vê o módulo na barra lateral e pode consultá-lo.
              <br />
              <strong>Cadastrar:</strong> pode criar, editar e excluir registros nesse módulo.
            </p>

            <div className="grid grid-cols-[1fr_64px_72px] gap-x-2 text-[11px] font-semibold text-muted-foreground mb-1 px-1">
              <span>Módulo</span>
              <span className="text-center">Acesso</span>
              <span className="text-center">Cadastrar</span>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-0.5">
              {(["Painel", "Operações", "Gestão"] as const).map((group) => {
                const items = MODULES_LIST.filter((m) => m.group === group);
                return (
                  <div key={group}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1 px-1">{group}</p>
                    <div className="space-y-0.5">
                      {items.map((m) => {
                        const state = perms[m.key] ?? { canAccess: false, canEdit: false };
                        return (
                          <div key={m.key} className="grid grid-cols-[1fr_64px_72px] gap-x-2 items-center rounded-md px-1 py-1.5 hover:bg-muted/40 transition-colors">
                            <span className="text-sm">{m.label}</span>
                            <div className="flex justify-center">
                              <Switch checked={state.canAccess} onCheckedChange={(v) => toggleAccess(m.key, v)} className="scale-90" />
                            </div>
                            <div className="flex justify-center">
                              <Switch checked={state.canEdit} onCheckedChange={(v) => toggleEdit(m.key, v)} disabled={!state.canAccess} className="scale-90" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t mt-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Salvar permissões
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── SMTP Config Panel ─────────────────────────────────────────────────────────

function SmtpConfigPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: status, isLoading: statusLoading } = useGetSmtpStatus();

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testPending, setTestPending] = useState(false);

  const { mutate: save, isPending: isSaving } = useUpdateSmtpConfig({
    mutation: {
      onSuccess: () => {
        toast({ title: "Configuração SMTP salva!" });
        void qc.invalidateQueries({ queryKey: getGetSmtpStatusQueryKey() });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao salvar configuração SMTP.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      },
    },
  });

  const { mutate: clearConfig, isPending: isClearing } = useDeleteSmtpConfig({
    mutation: {
      onSuccess: () => {
        toast({ title: "Configuração SMTP removida", description: "Revertido para variáveis de ambiente (se configuradas)." });
        void qc.invalidateQueries({ queryKey: getGetSmtpStatusQueryKey() });
        setHost(""); setPort("587"); setUser(""); setPass(""); setFrom("");
      },
      onError: () => toast({ title: "Erro ao remover configuração", variant: "destructive" }),
    },
  });

  const { mutate: testSend } = useTestSmtpConfig({
    mutation: {
      onSuccess: (data) => {
        setTestResult({ success: true, message: data.message });
        setTestPending(false);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Falha no envio de teste.";
        setTestResult({ success: false, message: msg });
        setTestPending(false);
      },
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    save({ data: { host: host.trim(), port: parseInt(port) || 587, user: user.trim(), pass: pass.trim(), from: from.trim() || undefined } });
  }

  function handleTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail.trim()) return;
    setTestResult(null);
    setTestPending(true);
    testSend({ data: { to: testEmail.trim() } });
  }

  const configured = status?.configured;
  const source = status?.source;

  return (
    <Card className="shadow-sm mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Configuração SMTP</CardTitle>
          {!statusLoading && (
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${configured ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {configured ? (source === "db" ? "Configurado (BD)" : "Configurado (env)") : "Não configurado"}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Necessário para envio de relatórios agendados e alertas de metas por e-mail.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusLoading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            {configured && source === "env" && (
              <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
                <Server className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  SMTP configurado via variáveis de ambiente. Salvar abaixo sobrescreve com configuração no banco de dados.
                  <br />
                  <span className="font-medium">{status?.user}</span> via <span className="font-medium">{status?.host}:{status?.port}</span>
                </span>
              </div>
            )}
            {configured && source === "db" && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Configurado no banco de dados.{" "}
                  <span className="font-medium">{status?.user}</span> via <span className="font-medium">{status?.host}:{status?.port}</span>
                </span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="smtp-host">Servidor (host)</Label>
                  <Input id="smtp-host" placeholder="smtp.gmail.com" value={host} onChange={(e) => setHost(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="smtp-port">Porta</Label>
                  <Input id="smtp-port" type="number" min="1" max="65535" value={port} onChange={(e) => setPort(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-user">Usuário / E-mail de envio</Label>
                <Input id="smtp-user" type="email" placeholder="noreply@empresa.com.br" value={user} onChange={(e) => setUser(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-pass">Senha / App password</Label>
                <div className="relative">
                  <Input
                    id="smtp-pass"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-from">Remetente (from) <span className="text-muted-foreground">(opcional — padrão: usuário acima)</span></Label>
                <Input id="smtp-from" type="email" placeholder="NEXUS ERP <noreply@empresa.com.br>" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="flex items-center justify-between pt-1 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  disabled={isClearing || source !== "db"}
                  onClick={() => clearConfig(undefined)}
                >
                  {isClearing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Remover configuração
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar configuração
                </Button>
              </div>
            </form>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Testar conexão</p>
              <form onSubmit={handleTest} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="smtp-test-to" className="text-xs">Enviar e-mail de teste para</Label>
                  <Input
                    id="smtp-test-to"
                    type="email"
                    placeholder="admin@empresa.com.br"
                    value={testEmail}
                    onChange={(e) => { setTestEmail(e.target.value); setTestResult(null); }}
                    required
                  />
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={testPending || !configured}>
                  {testPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                  Testar conexão
                </Button>
              </form>
              {testResult && (
                <div className={`mt-2 rounded-md px-3 py-2 text-xs flex items-start gap-2 ${testResult.success ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {testResult.success ? <CheckCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Backup Panel ──────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatNextBackup(schedule: BackupSchedule): string {
  const now = new Date();
  const next = new Date();
  next.setHours(schedule.hour, schedule.minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function BackupSchedulePanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: schedule, isLoading: schedLoading } = useGetBackupSchedule();

  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(2);
  const [minute, setMinute] = useState(0);
  const [retentionDays, setRetentionDays] = useState(7);
  const [synced, setSynced] = useState(false);

  if (schedule && !synced) {
    setSynced(true);
    setEnabled(schedule.enabled);
    setHour(schedule.hour);
    setMinute(schedule.minute);
    setRetentionDays(schedule.retentionDays);
  }

  const { mutate: saveSchedule, isPending: isSaving } = useUpdateBackupSchedule({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getGetBackupScheduleQueryKey() });
        toast({ title: "Agendamento salvo!", description: enabled ? `Backup automático ativado às ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} diariamente.` : "Backup automático desativado." });
      },
      onError: (err: unknown) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Erro ao salvar agendamento.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      },
    },
  });

  function handleSave() {
    saveSchedule({ data: { enabled, hour, minute, retentionDays } });
  }

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <Card className="shadow-sm mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Agendamento Automático</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedLoading ? (
          <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração…
          </div>
        ) : (
          <>
            {schedule?.enabled && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Backup automático <strong>ativo</strong> — próximo agendado para <strong>{formatNextBackup(schedule)}</strong></span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Ativar backup diário automático</p>
                <p className="text-xs text-muted-foreground">O sistema executará pg_dump automaticamente no horário configurado.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className={`space-y-3 transition-opacity ${!enabled ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hora do backup</Label>
                  <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hourOptions.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, "0")}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Minuto</Label>
                  <Select value={String(minute)} onValueChange={(v) => setMinute(Number(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minuteOptions.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          :{String(m).padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Retenção dos arquivos</Label>
                <Select value={String(retentionDays)} onValueChange={(v) => setRetentionDays(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="3">3 dias</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="14">14 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Arquivos mais antigos serão substituídos pelo próximo backup.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Salvar agendamento
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BackupPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  const { data: logs, isLoading: logsLoading } = useListBackupLogs();
  const { data: backupConfig } = useGetBackupConfig();
  const encryptionEnabled = backupConfig?.encryptionEnabled ?? false;

  const { mutate: generateBackup, isPending } = useGenerateBackup({
    mutation: {
      onSuccess: (blob) => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const base = `nexus-erp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
        const filename = encryptionEnabled ? `${base}.sql.gz.enc` : `${base}.sql.gz`;
        setLastFilename(filename);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        void qc.invalidateQueries({ queryKey: getListBackupLogsQueryKey() });
        toast({ title: "Backup gerado com sucesso!", description: `Download iniciado: ${filename}` });
      },
      onError: (err: unknown) => {
        const apiErr = err as { data?: { error?: string }; message?: string };
        const msg =
          apiErr?.data?.error ??
          apiErr?.message ??
          "Erro ao gerar backup. Verifique se pg_dump está disponível.";
        toast({ title: "Erro ao gerar backup", description: msg, variant: "destructive" });
      },
    },
  });

  return (
    <Card className="shadow-sm mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Backup do Banco de Dados</CardTitle>
            {encryptionEnabled ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                <Lock className="h-3 w-3" /> Criptografado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <LockOpen className="h-3 w-3" /> Sem criptografia
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateBackup()}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Gerando backup…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Gerar Backup Agora
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {encryptionEnabled ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4 shrink-0" />
              Backup protegido com AES-256-CBC
            </div>
            <p className="text-xs leading-relaxed">
              O arquivo gerado (<span className="font-mono">.sql.gz.enc</span>) é criptografado com a chave <span className="font-mono">BACKUP_ENCRYPTION_KEY</span>.
              Para descriptografar e restaurar, execute no terminal:
            </p>
            <pre className="text-xs bg-emerald-900/10 rounded px-3 py-2 font-mono whitespace-pre-wrap break-all leading-relaxed">
              {`openssl enc -d -aes-256-cbc -pbkdf2 \\\n  -pass env:BACKUP_ENCRYPTION_KEY \\\n  -in backup.sql.gz.enc \\\n  | gunzip \\\n  | psql -h HOST -U USER -d DATABASE`}
            </pre>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <LockOpen className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Criptografia não configurada. Defina o secret <span className="font-mono font-medium">BACKUP_ENCRYPTION_KEY</span> no painel de configurações para proteger os arquivos de backup com AES-256.
            </span>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>Executando <code className="font-mono text-xs">pg_dump</code> e comprimindo… aguarde o download iniciar automaticamente.</span>
          </div>
        )}
        {lastFilename && !isPending && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>Último backup baixado: <span className="font-mono text-xs">{lastFilename}</span></span>
          </div>
        )}

        <div>
          <p className="text-sm font-medium mb-2">Histórico de backups (últimos 20)</p>
          {logsLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum backup gerado ainda.</p>
              <p className="text-xs mt-1">Clique em "Gerar Backup Agora" para criar o primeiro backup.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Arquivo</TableHead>
                    <TableHead className="text-xs text-right">Tamanho</TableHead>
                    <TableHead className="text-xs">Gerado em</TableHead>
                    <TableHead className="text-xs">Origem</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Storage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs as BackupLog[]).map((log) => (
                    <TableRow key={log.id} className={log.status === "error" ? "bg-red-50/50" : undefined}>
                      <TableCell className="text-xs font-mono">{log.filename}</TableCell>
                      <TableCell className="text-xs text-right">{formatBytes(log.fileSizeBytes)}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.source === "scheduled" ? (
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <CalendarClock className="h-3 w-3" /> Automático
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            <Download className="h-3 w-3" /> Manual
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600" title={log.errorMessage ?? ""}>
                            <XCircle className="h-3 w-3" /> Falha
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.storageUrl ? (
                          <a
                            href={`/api/admin/backup/download/${log.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                            title="Baixar do storage externo (link válido por 1 hora)"
                          >
                            <Cloud className="h-3 w-3" />
                            Baixar
                          </a>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {encryptionEnabled
            ? "O arquivo gerado é um dump SQL criptografado com AES-256-CBC (.sql.gz.enc). Guarde a chave de criptografia em local seguro."
            : "O arquivo gerado é um dump SQL completo comprimido (.sql.gz). Guarde-o em local seguro."}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Restore Panel ─────────────────────────────────────────────────────────────

function RestorePanel() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [restoreResult, setRestoreResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { mutate: doRestore, isPending } = useRestoreBackup({
    mutation: {
      onSuccess: (data) => {
        setRestoreResult({ ok: true, message: data.message });
        setSelectedFile(null);
        setConfirmText("");
        toast({ title: "Restauração concluída!", description: data.message });
      },
      onError: (err: unknown) => {
        const msg =
          (err as { data?: { error?: string } })?.data?.error ??
          (err as { message?: string })?.message ??
          "Erro desconhecido ao restaurar.";
        setRestoreResult({ ok: false, message: msg });
        toast({ title: "Falha na restauração", description: msg, variant: "destructive" });
      },
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    setRestoreResult(null);
    setConfirmText("");
  }

  function handleRestoreClick() {
    if (!selectedFile) return;
    setConfirmOpen(true);
  }

  function handleConfirmRestore() {
    if (!selectedFile || confirmText !== "RESTAURAR") return;
    setConfirmOpen(false);
    doRestore({ data: { file: selectedFile } });
  }

  const isValidFile =
    selectedFile &&
    (selectedFile.name.endsWith(".sql.gz") || selectedFile.name.endsWith(".sql.gz.enc"));

  return (
    <Card className="shadow-sm mt-6 border-red-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          <CardTitle className="text-base text-red-700">Restaurar Banco de Dados</CardTitle>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
            Zona de Perigo
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-2">
          <div className="flex items-start gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            O que esta operação faz:
          </div>
          <ul className="list-disc list-inside text-xs space-y-1 leading-relaxed ml-1">
            <li>Apaga <strong>TODOS</strong> os dados atuais do banco de dados</li>
            <li>Restaura exatamente o conteúdo do arquivo de backup selecionado</li>
            <li>Nenhuma informação fora do backup sobreviverá</li>
            <li>A operação é <strong>irreversível</strong> — faça um novo backup antes se necessário</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Selecionar arquivo de backup</Label>
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg px-6 py-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            onClick={() => document.getElementById("restore-file-input")?.click()}
          >
            <UploadCloud className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {selectedFile ? (
                <span className="font-medium text-foreground">{selectedFile.name}</span>
              ) : (
                <>Clique para selecionar um arquivo <span className="font-mono text-xs">.sql.gz</span> ou <span className="font-mono text-xs">.sql.gz.enc</span></>
              )}
            </p>
            {selectedFile && (
              <p className="text-xs text-muted-foreground mt-1">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
          <input
            id="restore-file-input"
            type="file"
            accept=".sql.gz,.enc"
            className="hidden"
            onChange={handleFileChange}
          />
          {selectedFile && !isValidFile && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Arquivo inválido. Use apenas arquivos <span className="font-mono">.sql.gz</span> ou <span className="font-mono">.sql.gz.enc</span> gerados pelo NEXUS ERP.
            </p>
          )}
        </div>

        {isPending && (
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            <RotateCcw className="h-4 w-4 animate-spin shrink-0" />
            <span>Restaurando banco de dados… Aguarde, isso pode levar alguns minutos.</span>
          </div>
        )}

        {restoreResult && !isPending && (
          <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${restoreResult.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {restoreResult.ok ? (
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{restoreResult.message}</span>
          </div>
        )}

        <Button
          variant="destructive"
          size="sm"
          disabled={!isValidFile || isPending}
          onClick={handleRestoreClick}
        >
          {isPending ? (
            <>
              <RotateCcw className="h-4 w-4 animate-spin mr-2" />
              Restaurando…
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Backup
            </>
          )}
        </Button>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              Confirmar Restauração do Banco
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Você está prestes a restaurar o banco de dados a partir de:
                </p>
                <p className="font-mono text-xs bg-muted px-3 py-2 rounded break-all">
                  {selectedFile?.name}
                </p>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-xs space-y-1">
                  <p className="font-semibold">Esta ação irá:</p>
                  <p>• Apagar permanentemente todos os dados atuais</p>
                  <p>• Restaurar exatamente o conteúdo do backup acima</p>
                  <p>• Isso não pode ser desfeito</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Para confirmar, digite <span className="font-mono font-bold text-red-700">RESTAURAR</span> abaixo:
                  </Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="RESTAURAR"
                    className="font-mono text-sm"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={confirmText !== "RESTAURAR"}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Confirmar Restauração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  if (user?.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const { data, isLoading } = useListUsuarios();
  const users = data?.users ?? [];

  const { mutate: deleteUser } = useDeleteUsuario({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListUsuariosQueryKey() });
        toast({ title: "Colaborador excluído." });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao excluir.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      },
    },
  });

  const { toast } = useToast();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getListUsuariosQueryKey() });
  }

  const stats = {
    total: users.length,
    active: users.filter((u) => u.active).length,
    admins: users.filter((u) => u.role === "admin").length,
    managers: users.filter((u) => u.role === "manager").length,
  };

  return (
    <AppLayout>
      <PageHeader
        title="Gestão de Usuários"
        subtitle="Cadastre colaboradores e gerencie seus perfis de acesso ao sistema."
        actions={<CreateUsuarioDialog onSuccess={refresh} />}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total de usuários", value: stats.total, icon: Users, color: "text-blue-500" },
          { label: "Contas ativas", value: stats.active, icon: UserCheck, color: "text-emerald-500" },
          { label: "Administradores", value: stats.admins, icon: Shield, color: "text-red-500" },
          { label: "Gerentes", value: stats.managers, icon: UserX, color: "text-purple-500" },
        ].map((s) => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
                <div>
                  <p className="text-2xl font-bold leading-tight">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Colaboradores cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum colaborador cadastrado</p>
              <p className="text-sm">Clique em "Novo colaborador" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className={!u.active ? "opacity-50" : undefined}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {u.name}
                          {u.id === user?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                          )}
                        </span>
                        {u.employeeId && u.employeeName && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit cursor-pointer"
                            title="Abrir ficha do funcionário no módulo RH"
                            onClick={() => setLocation(`/rh?tab=employees&employeeId=${u.employeeId}`)}
                          >
                            <Link2 className="h-3 w-3" />
                            {u.employeeName}
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell>
                      {(u as any).sector ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {SECTOR_LABELS_UI[(u as any).sector] ?? (u as any).sector}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <UserCheck className="h-3.5 w-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                          <UserX className="h-3.5 w-3.5" /> Inativo
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <PermissoesDialog targetUser={u} />
                        <EditUsuarioDialog user={u} currentUserId={user?.id ?? 0} onSuccess={refresh} />
                        {u.id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso vai remover <strong>{u.name}</strong> permanentemente do sistema. Esta ação não pode ser desfeita.
                                  <br /><br />
                                  Se quiser apenas bloquear o acesso temporariamente, use a opção <strong>"Desativar conta"</strong> na edição.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteUser({ id: u.id })}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BackupPanel />
      <RestorePanel />
      <BackupSchedulePanel />
      <SmtpConfigPanel />

      {/* Permissions reference */}
      <Card className="shadow-sm mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Referência de permissões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                role: "employee",
                title: "Colaborador",
                permissions: [
                  "Ver dashboard e módulos",
                  "Registrar movimentos de estoque",
                  "Lançar pedidos de venda",
                  "Ver projetos e tarefas",
                  "Registrar ponto (RH)",
                ],
              },
              {
                role: "manager",
                title: "Gerente",
                permissions: [
                  "Tudo do Colaborador",
                  "Configurar metas mensais",
                  "Ver relatórios executivos",
                  "Aprovar pedidos de compra",
                  "Gerenciar funcionários (RH)",
                ],
              },
              {
                role: "admin",
                title: "Administrador",
                permissions: [
                  "Tudo do Gerente",
                  "Gerenciar usuários do sistema",
                  "Configurar alertas de e-mail",
                  "Excluir registros críticos",
                  "Acesso total a todos os módulos",
                ],
              },
            ].map((p) => (
              <div key={p.role} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <RoleBadge role={p.role} />
                  <span className="font-medium text-sm">{p.title}</span>
                </div>
                <ul className="space-y-1">
                  {p.permissions.map((perm) => (
                    <li key={perm} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-0.5 text-emerald-500">✓</span>
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
