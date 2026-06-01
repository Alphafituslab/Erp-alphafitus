import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Hexagon } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin();

  if (isAuthenticated) {
    const home = user?.role === "employee" ? "/dashboard" : "/relatorios";
    return <Redirect to={home} />;
  }

  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate({ data }, {
      onSuccess: (response) => {
        queryClient.setQueryData(getGetMeQueryKey(), response);
        const home = response.role === "employee" ? "/dashboard" : "/relatorios";
        setLocation(home);
      },
      onError: (error) => {
        toast({
          title: "Erro de autenticação",
          description: error.data?.error || "Verifique suas credenciais e tente novamente.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* Left side: Branding */}
      <div className="hidden md:flex flex-1 bg-sidebar border-r border-sidebar-border flex-col justify-between p-12 text-sidebar-foreground">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Hexagon className="size-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">NEXUS ERP</span>
          </div>
          <div className="mt-24 max-w-md">
            <h1 className="text-4xl font-semibold tracking-tight leading-tight mb-6">
              Sistema integrado de gestão empresarial.
            </h1>
            <p className="text-sidebar-foreground/70 text-lg">
              Acesso exclusivo para colaboradores. Autentique-se para acessar o painel de controle e módulos operacionais.
            </p>
          </div>
        </div>
        <div className="text-sm text-sidebar-foreground/50">
          &copy; {new Date().getFullYear()} Nexus Corporation.
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden flex items-center gap-3 justify-center">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Hexagon className="size-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">NEXUS ERP</span>
          </div>
          
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Acesso ao Sistema</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Insira suas credenciais para continuar.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail corporativo</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario@nexus.com.br" type="email" autoComplete="email" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Senha de acesso</FormLabel>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Autenticando..." : "Entrar no sistema"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
