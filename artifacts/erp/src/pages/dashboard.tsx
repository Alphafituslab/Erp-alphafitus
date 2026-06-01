import { useAuth } from "@/contexts/auth";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Truck,
  Users,
  FolderKanban,
  FileText,
  BarChart2,
  ClipboardCheck,
  ArrowUpRight,
} from "lucide-react";

const MODULES = [
  {
    href: "/financeiro",
    label: "Financeiro",
    description: "Contas a pagar, receber e fluxo de caixa",
    icon: DollarSign,
    color: "bg-emerald-500",
    light: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    href: "/vendas",
    label: "Vendas",
    description: "Pedidos, orçamentos e clientes",
    icon: ShoppingCart,
    color: "bg-blue-500",
    light: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-600 dark:text-blue-400",
  },
  {
    href: "/estoque",
    label: "Estoque",
    description: "Inventário, lotes e movimentações",
    icon: Package,
    color: "bg-amber-500",
    light: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    href: "/compras",
    label: "Compras",
    description: "Cotações, pedidos e fornecedores",
    icon: Truck,
    color: "bg-purple-500",
    light: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-600 dark:text-purple-400",
  },
  {
    href: "/rh",
    label: "RH",
    description: "Funcionários, departamentos e presença",
    icon: Users,
    color: "bg-pink-500",
    light: "bg-pink-50 dark:bg-pink-950/40",
    text: "text-pink-600 dark:text-pink-400",
  },
  {
    href: "/projetos",
    label: "Projetos",
    description: "Cronogramas, tarefas e alocações",
    icon: FolderKanban,
    color: "bg-indigo-500",
    light: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  {
    href: "/fiscal",
    label: "Fiscal",
    description: "Notas fiscais e apuração de impostos",
    icon: FileText,
    color: "bg-orange-500",
    light: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-600 dark:text-orange-400",
  },
  {
    href: "/qualidade",
    label: "Qualidade",
    description: "Inspeções, laudos e não conformidades",
    icon: ClipboardCheck,
    color: "bg-teal-500",
    light: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-600 dark:text-teal-400",
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    description: "Indicadores executivos e dashboards",
    icon: BarChart2,
    color: "bg-primary",
    light: "bg-primary/10",
    text: "text-primary",
  },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title={`Bem-vindo, ${user?.name?.split(" ")[0] || "Usuário"}`}
          subtitle="Acesse os módulos operacionais do alphafitus ERP"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map((mod) => (
            <Link key={mod.href} href={mod.href} className="block group">
              <Card className="h-full transition-all duration-150 hover:border-primary/40 hover:shadow-md cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-9 w-9 rounded-lg ${mod.light} flex items-center justify-center flex-shrink-0`}>
                      <mod.icon className={`h-4.5 w-4.5 ${mod.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{mod.label}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                      <CardDescription className="text-xs mt-0.5 line-clamp-1">{mod.description}</CardDescription>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
