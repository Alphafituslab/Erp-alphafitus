import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Home className="h-3 w-3 flex-shrink-0 opacity-50" />
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-40" />
              {item.href ? (
                <Link href={item.href} className="hover:text-primary transition-colors font-medium">
                  {item.label}
                </Link>
              ) : (
                <span className={i === breadcrumb.length - 1 ? "text-foreground font-semibold" : "font-medium"}>
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[1.35rem] font-bold tracking-tight text-foreground leading-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground font-normal">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
            {actions}
          </div>
        )}
      </div>

      {/* Accent separator */}
      <div className="mt-4 h-px bg-gradient-to-r from-border via-border/60 to-transparent" />
    </div>
  );
}
