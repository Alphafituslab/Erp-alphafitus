import { useAuth } from "@/contexts/auth";
import { AppLayout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
  ArrowUpRight
} from "lucide-react";

const MODULES = [
  { href: "/financeiro", label: "Financeiro", description: "Contas a pagar, receber e tesouraria", icon: DollarSign },
  { href: "/vendas", label: "Vendas", description: "Pedidos, orçamentos e clientes", icon: ShoppingCart },
  { href: "/estoque", label: "Estoque", description: "Inventário, movimentações e armazéns", icon: Package },
  { href: "/compras", label: "Compras", description: "Cotações, pedidos e fornecedores", icon: Truck },
  { href: "/rh", label: "RH", description: "Folha, benefícios e recrutamento", icon: Users },
  { href: "/projetos", label: "Projetos", description: "Cronogramas, tarefas e alocações", icon: FolderKanban },
  { href: "/fiscal", label: "Fiscal", description: "Notas fiscais e apuração de impostos", icon: FileText },
  { href: "/relatorios", label: "Relatórios", description: "BI e extração de dados integrados", icon: BarChart2 },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo ao ERP, {user?.name?.split(' ')[0] || 'Usuário'}</h1>
          <p className="text-muted-foreground mt-2">Acesso aos módulos operacionais do sistema.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MODULES.map((mod) => (
            <Link key={mod.href} href={mod.href} className="block group">
              <Card className="h-full transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer bg-card hover:bg-accent/5">
                <CardHeader className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <mod.icon className="h-5 w-5" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="text-lg">{mod.label}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">{mod.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
