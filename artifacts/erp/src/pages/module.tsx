import { AppLayout } from "@/components/layout";
import { useParams } from "wouter";

export default function ModulePlaceholderPage() {
  const params = useParams();
  // Try to capitalize first letter
  const moduleName = params.module ? params.module.charAt(0).toUpperCase() + params.module.slice(1) : "Módulo";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto mt-12 text-center space-y-6">
        <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium tracking-tight border">
          Módulo em desenvolvimento
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Módulo {moduleName}</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Este módulo está atualmente em construção. As funcionalidades de gestão para esta área estarão disponíveis na próxima atualização do sistema.
        </p>
      </div>
    </AppLayout>
  );
}
