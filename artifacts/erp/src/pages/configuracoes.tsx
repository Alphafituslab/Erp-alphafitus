import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/contexts/auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Loader2,
  Upload,
  X,
  CheckCircle,
  ImageIcon,
} from "lucide-react";
import {
  useGetCompanySettings,
  useUpdateCompanySettings,
  getGetCompanySettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function CompanySettingsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useGetCompanySettings();

  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null | undefined>(undefined);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const syncedSettingsRef = useRef<typeof settings>(undefined);
  if (settings !== syncedSettingsRef.current) {
    syncedSettingsRef.current = settings;
    if (settings) {
      if (companyName === null) setCompanyName(settings.companyName ?? "");
      if (logoBase64 === undefined && !removeLogo) {
        setLogoPreview(settings.logoBase64 ?? null);
      }
    }
  }

  const { mutate: save, isPending: isSaving } = useUpdateCompanySettings({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Configurações salvas!",
          description: "Os dados da empresa foram atualizados com sucesso.",
        });
        void qc.invalidateQueries({ queryKey: getGetCompanySettingsQueryKey() });
        syncedSettingsRef.current = undefined;
        setLogoBase64(undefined);
        setRemoveLogo(false);
        setLogoPreview(data.logoBase64 ?? null);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Erro ao salvar configurações.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      },
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setLogoBase64(result);
      setLogoPreview(result);
      setRemoveLogo(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleRemoveLogo() {
    setLogoBase64(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload: { companyName?: string; logoBase64?: string | null } = {};
    if (companyName !== null) payload.companyName = companyName;
    if (logoBase64 !== undefined) payload.logoBase64 = logoBase64;
    else if (removeLogo) payload.logoBase64 = null;
    save({ data: payload });
  }

  const currentLogo = logoPreview ?? settings?.logoBase64;
  const currentName = companyName ?? settings?.companyName ?? "";
  const isDirty =
    (companyName !== null && companyName !== (settings?.companyName ?? "")) ||
    logoBase64 !== undefined ||
    removeLogo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando configurações…</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Identidade da Empresa
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Estas informações aparecem nos PDFs exportados e no cabeçalho do sistema.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company-name">Nome da empresa</Label>
            <Input
              id="company-name"
              value={currentName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Alphafitus Indústria Ltda."
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Usado no cabeçalho de relatórios e documentos exportados.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Logotipo</Label>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 flex items-center justify-center overflow-hidden">
                {currentLogo ? (
                  <img
                    src={currentLogo}
                    alt="Logo da empresa"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                )}
              </div>

              <div className="flex flex-col gap-2 justify-center pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {currentLogo ? "Trocar logo" : "Enviar logo"}
                </Button>
                {currentLogo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remover logo
                  </Button>
                )}
                <p className="text-xs text-muted-foreground max-w-[200px] leading-snug">
                  PNG, JPG ou SVG. Recomendado: fundo transparente, mínimo 200×200px.
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSaving || !isDirty} className="gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          {isSaving ? "Salvando…" : "Salvar configurações"}
        </Button>
        {!isDirty && !isSaving && (
          <span className="text-xs text-muted-foreground">Sem alterações pendentes</span>
        )}
      </div>
    </form>
  );
}

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Configurações"
        subtitle="Gerencie as configurações gerais da empresa."
      />
      <CompanySettingsPanel />
    </AppLayout>
  );
}
