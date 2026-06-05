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
} from "@workspace/api-client-react";
import type { UserItem, BackupLog } from "@workspace/api-client-react";
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
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger>
                <SelectValue placeholder="Sem setor específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sem setor</SelectItem>
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
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger>
                <SelectValue placeholder="Sem setor específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sem setor</SelectItem>
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

// ── Backup Panel ──────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function BackupPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  const { data: logs, isLoading: logsLoading } = useListBackupLogs();

  const { mutate: generateBackup, isPending } = useGenerateBackup({
    mutation: {
      onSuccess: (blob) => {
        // Derive filename client-side — mirrors server timestamp logic (minute precision)
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const filename = `nexus-erp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.sql.gz`;
        setLastFilename(filename);

        // Trigger browser download from the received blob
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Invalidate logs only after confirmed server success (not a timer)
        void qc.invalidateQueries({ queryKey: getListBackupLogsQueryKey() });
        toast({ title: "Backup gerado com sucesso!", description: `Download iniciado: ${filename}` });
      },
      onError: (err: unknown) => {
        // customFetch throws ApiError — data field contains parsed JSON body
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
                    <TableHead className="text-xs">Usuário (ID)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs as BackupLog[]).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono">{log.filename}</TableCell>
                      <TableCell className="text-xs text-right">{formatBytes(log.fileSizeBytes)}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">#{log.userId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          O arquivo gerado é um dump SQL completo comprimido (.sql.gz). Guarde-o em local seguro.
          Restore deve ser realizado diretamente no servidor com <code className="font-mono">psql</code> ou <code className="font-mono">pg_restore</code>.
        </p>
      </CardContent>
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
