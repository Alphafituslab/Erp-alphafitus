declare module "html-to-image" {
  export function toPng(node: HTMLElement, options?: Record<string, unknown>): Promise<string>;
}

declare module "jspdf" {
  interface JsPDFOptions {
    orientation?: "portrait" | "landscape";
    unit?: "mm" | "cm" | "in" | "px";
    format?: string | [number, number];
  }
  interface JsPDFInternal {
    pageSize: {
      getWidth(): number;
      getHeight(): number;
    };
  }
  class JsPDF {
    internal: JsPDFInternal;
    constructor(options?: JsPDFOptions);
    addPage(): JsPDF;
    addImage(
      imageData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): JsPDF;
    save(filename: string): void;
  }
  export { JsPDF };
}
