"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ToastVariant = "default" | "success" | "destructive";

type ToastItem = { id: string; message: string; variant: ToastVariant };

type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = { toast: (opts: ToastOptions) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const DEFAULT_DURATION = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ message, variant = "default", duration = DEFAULT_DURATION }) => {
      const id = `toast-${counter.current++}`;
      setItems((xs) => [...xs, { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((item) => (
          <ToastRow key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toastVariants = cva(
  "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-popover px-3.5 py-3 text-sm shadow-lg ring-1 ring-foreground/5 animate-in fade-in slide-in-from-bottom-2",
  {
    variants: {
      variant: {
        default: "text-foreground [&_[data-icon]]:text-muted-foreground",
        success: "text-foreground [&_[data-icon]]:text-success",
        destructive: "text-foreground [&_[data-icon]]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const ICONS: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  destructive: CircleAlert,
};

function ToastRow({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
} & VariantProps<typeof toastVariants>) {
  const Icon = ICONS[item.variant];
  return (
    <div
      role={item.variant === "destructive" ? "alert" : "status"}
      className={cn(toastVariants({ variant: item.variant }))}
    >
      <Icon data-icon className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1 pt-px">{item.message}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="-mr-1 -mt-0.5"
      >
        <X />
      </Button>
    </div>
  );
}
