import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, Upload, ImageIcon } from "lucide-react";
import {
  useGetCompanySettings,
  useUpdateCompanySettings,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

// ── PDF settings ──────────────────────────────────────────────────────────────

const PDF_SETTINGS_KEY = "erp_pdf_settings";

export interface PdfSettings {
  companyName: string;
  logoBase64: string | null;
  includeHeader: boolean;
}

export function loadLocalPdfSettings(): Partial<PdfSettings> {
  try {
    const raw = localStorage.getItem(PDF_SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as Partial<PdfSettings>;
  } catch {}
  return {};
}

export function saveLocalPdfSettings(s: Partial<PdfSettings>) {
  try {
    localStorage.setItem(PDF_SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

// ── Shared PDF header helper ──────────────────────────────────────────────────

export function addPdfHeader(
  doc: import("jspdf").jsPDF,
  settings: PdfSettings,
  title: string,
  subtitle?: string,
): number {
  const lm = 14;
  const rm = 196;
  const cw = rm - lm;
  let y = 10;

  if (settings.includeHeader) {
    doc.setFillColor("#1e3a5f");
    doc.rect(lm, y, cw, 16, "F");

    let textX = lm + 4;

    if (settings.logoBase64) {
      try {
        const ext = settings.logoBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(settings.logoBase64, ext, lm + 2, y + 2, 12, 12);
        textX = lm + 18;
      } catch {}
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#ffffff");
    doc.text(title, textX, y + 7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(settings.companyName, textX, y + 12.5);
    y += 20;

    if (subtitle) {
      doc.setFontSize(9);
      doc.setTextColor("#555555");
      doc.text(subtitle, lm, y);
      y += 6;
    }

    doc.setDrawColor("#e2e8f0");
    doc.line(lm, y, rm, y);
    y += 4;
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#000000");
    doc.text(title, lm, y + 6);
    y += 12;
    if (subtitle) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor("#555555");
      doc.text(subtitle, lm, y);
      y += 6;
    }
  }

  return y;
}

export function addPdfFooter(doc: import("jspdf").jsPDF, settings: PdfSettings) {
  if (!settings.includeHeader) return;
  const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor("#aaaaaa");
    doc.setFont("helvetica", "normal");
    const now = new Date().toLocaleString("pt-BR");
    doc.text(`Gerado em ${now}`, 14, 287);
    doc.text(`Página ${i} de ${pageCount}`, 196, 287, { align: "right" });
    doc.setDrawColor("#e2e8f0");
    doc.line(14, 284, 196, 284);
  }
}

// ── PdfExportDialog ───────────────────────────────────────────────────────────

interface PdfExportDialogProps {
  onExport: (settings: PdfSettings) => Promise<void>;
  disabled?: boolean;
  label?: string;
}

export function PdfExportDialog({
  onExport,
  disabled = false,
  label = "Exportar PDF",
}: PdfExportDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: serverSettings, isLoading: loadingServer } = useGetCompanySettings();
  const updateCompanyMutation = useUpdateCompanySettings();

  const localFallback = loadLocalPdfSettings();

  const [settings, setSettings] = useState<PdfSettings>({
    companyName: localFallback.companyName ?? "NEXUS ERP",
    logoBase64: localFallback.logoBase64 ?? null,
    includeHeader: localFallback.includeHeader ?? true,
  });

  useEffect(() => {
    if (serverSettings) {
      setSettings((prev) => ({
        ...prev,
        companyName: serverSettings.companyName ?? prev.companyName,
        logoBase64: serverSettings.logoBase64 ?? prev.logoBase64,
      }));
    }
  }, [serverSettings]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettings((prev) => ({
        ...prev,
        logoBase64: (ev.target?.result as string) ?? null,
      }));
    };
    reader.readAsDataURL(file);
  }

  async function handleExport() {
    saveLocalPdfSettings({ includeHeader: settings.includeHeader });
    updateCompanyMutation.mutate(
      { data: { companyName: settings.companyName, logoBase64: settings.logoBase64 } },
      {
        onError: () => {
          toast({
            title: "Aviso",
            description: "Não foi possível salvar as configurações no servidor.",
            variant: "destructive",
          });
        },
      }
    );
    setExporting(true);
    try {
      await onExport(settings);
      setOpen(false);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Relatório em PDF
          </DialogTitle>
        </DialogHeader>

        {loadingServer ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox
                id="include-header"
                checked={settings.includeHeader}
                onCheckedChange={(v) =>
                  setSettings((prev) => ({ ...prev, includeHeader: !!v }))
                }
              />
              <Label htmlFor="include-header" className="cursor-pointer leading-snug">
                Incluir cabeçalho com logo e rodapé com numeração de páginas
              </Label>
            </div>

            {settings.includeHeader && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="pdf-company-name">Nome da empresa</Label>
                  <Input
                    id="pdf-company-name"
                    value={settings.companyName}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, companyName: e.target.value }))
                    }
                    placeholder="Ex: Empresa Ltda."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Logo da empresa</Label>
                  <div className="flex items-center gap-3">
                    {settings.logoBase64 ? (
                      <img
                        src={settings.logoBase64}
                        alt="Logo"
                        className="h-10 w-auto max-w-[80px] object-contain border rounded p-0.5"
                      />
                    ) : (
                      <div className="h-10 w-10 border rounded flex items-center justify-center bg-muted">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {settings.logoBase64 ? "Trocar logo" : "Carregar logo"}
                    </Button>
                    {settings.logoBase64 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSettings((prev) => ({ ...prev, logoBase64: null }))
                        }
                      >
                        Remover
                      </Button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG ou JPG recomendado. Configurações compartilhadas com todos os usuários.
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={exporting}
              >
                Cancelar
              </Button>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Gerando PDF…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
