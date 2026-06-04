import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/contexts/auth";
import { Redirect } from "wouter";
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
} from "lucide-react";
import {
  useListUsuarios,
  useCreateUsuario,
  useUpdateUsuario,
  useDeleteUsuario,
  getListUsuariosQueryKey,
} from "@workspace/api-client-react";
import type { UserItem } from "@workspace/api-client-react";
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

function CreateUsuarioDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "employee">("employee");
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
    setName(""); setEmail(""); setPassword(""); setRole("employee");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create({ data: { name, email, password, role } });
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
    if (v) { setName(user.name); setEmail(user.email); setPassword(""); setRole(user.role as typeof role); setActive(user.active); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Parameters<typeof update>[0]["data"] = { name, email, role, active };
    if (password) payload.password = password;
    update({ id: user.id, data: payload });
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className={!u.active ? "opacity-50" : undefined}>
                    <TableCell className="font-medium">
                      {u.name}
                      {u.id === user?.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
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
