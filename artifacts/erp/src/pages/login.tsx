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
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, BarChart3, Package, ShoppingCart, Users } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: BarChart3, label: "Dashboard gerencial em tempo real" },
  { icon: Package, label: "Controle de estoque e compras" },
  { icon: ShoppingCart, label: "Gestão de vendas e clientes" },
  { icon: Users, label: "RH, projetos e qualidade" },
];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLogin();

  if (isAuthenticated) return <Redirect to="/relatorios" />;

  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate({ data }, {
      onSuccess: (response) => {
        queryClient.setQueryData(getGetMeQueryKey(), response);
        setLocation("/relatorios");
      },
      onError: (error) => {
        toast({
          title: "Credenciais inválidas",
          description: error.data?.error || "Verifique seu e-mail e senha.",
          variant: "destructive",
        });
      },
    });
  }

  return (
    <div className="min-h-screen w-full flex">
      {/* ── Left panel ────────────────────────────────────────── */}
      <div
        className="hidden lg:flex w-[52%] flex-col justify-between p-14 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0a4a3a 0%, #0d6e52 40%, #12a07a 75%, #16c48a 100%)",
        }}
      >
        {/* Background decorative circles */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "rgba(255,255,255,0.3)" }}
        />
        <div
          className="absolute bottom-20 -left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: "rgba(255,255,255,0.2)" }}
        />
        <div
          className="absolute top-1/2 right-10 w-40 h-40 rounded-full opacity-5"
          style={{ background: "rgba(255,255,255,0.4)" }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-2">
            <img
              src={`${import.meta.env.BASE_URL}logo-alphafitus.png`}
              alt="alphafitus"
              className="h-9 w-auto brightness-0 invert"
            />
          </div>
          <div>
            <p className="text-white font-bold text-xl tracking-tight leading-none">alphafitus</p>
            <p className="text-white/60 text-xs tracking-widest uppercase font-medium">ERP Industrial</p>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-white text-4xl font-bold tracking-tight leading-tight mb-4">
              Gestão inteligente<br />para sua indústria.
            </h1>
            <p className="text-white/70 text-base leading-relaxed max-w-sm">
              Unifique todos os módulos operacionais em uma única plataforma de alto desempenho.
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/85 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/40 text-xs">
            &copy; {new Date().getFullYear()} alphafitus. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8fafb] px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo-alphafitus.png`}
            alt="alphafitus ERP"
            className="h-9 w-auto"
          />
          <span className="text-xl font-bold tracking-tight text-gray-800">alphafitus ERP</span>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.08)] border border-gray-100 p-8">
            {/* Header */}
            <div className="mb-8">
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                style={{ background: "linear-gradient(135deg, #0d6e52, #16c48a)" }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}logo-alphafitus.png`}
                  alt=""
                  className="h-6 w-auto brightness-0 invert"
                />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Bem-vindo de volta</h2>
              <p className="text-gray-500 text-sm mt-1">Entre com suas credenciais para acessar o sistema.</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium text-sm">E-mail</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="seu@alphafitus.com.br"
                          type="email"
                          autoComplete="email"
                          className="h-11 border-gray-200 bg-gray-50 focus:bg-white transition-colors rounded-xl text-sm"
                          {...field}
                        />
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
                      <FormLabel className="text-gray-700 font-medium text-sm">Senha</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="••••••••••"
                          type="password"
                          autoComplete="current-password"
                          className="h-11 border-gray-200 bg-gray-50 focus:bg-white transition-colors rounded-xl text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
                    style={{
                      background: loginMutation.isPending
                        ? "#9ca3af"
                        : "linear-gradient(135deg, #0d6e52 0%, #16c48a 100%)",
                      boxShadow: loginMutation.isPending ? "none" : "0 4px 15px rgba(22, 196, 138, 0.35)",
                    }}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Entrando…
                      </>
                    ) : (
                      "Entrar no sistema"
                    )}
                  </button>
                </div>
              </form>
            </Form>
          </div>

          <p className="text-center text-gray-400 text-xs mt-6">
            Acesso exclusivo para colaboradores autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}
