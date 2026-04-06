"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({
  className,
  toastOptions,
  style,
  position,
  richColors,
  expand,
  closeButton,
  gap,
  offset,
  ...props
}: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const defaultToastOptions: ToasterProps["toastOptions"] = {
    duration: 5000,
    classNames: {
      toast:
        "bg-slate-950/95 text-amber-100 border border-amber-500/50 shadow-[0_18px_50px_rgba(0,0,0,0.55)] rounded-xl",
      title: "text-sm sm:text-base font-semibold",
      description: "text-xs sm:text-sm text-amber-200/80",
    },
  };
  const mergedToastOptions: ToasterProps["toastOptions"] = {
    ...defaultToastOptions,
    ...toastOptions,
    classNames: {
      ...defaultToastOptions?.classNames,
      ...toastOptions?.classNames,
    },
  };

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={`toaster group ${className ?? ""}`}
      position={position ?? "top-right"}
      richColors={richColors ?? true}
      expand={expand ?? true}
      closeButton={closeButton ?? true}
      gap={gap ?? 12}
      offset={offset ?? 20}
      style={
        {
          "--normal-bg": "rgba(2, 6, 23, 0.98)",
          "--normal-text": "#FDE68A",
          "--normal-border": "rgba(245, 158, 11, 0.55)",
          ...(style ?? {}),
        } as React.CSSProperties
      }
      toastOptions={mergedToastOptions}
      {...props}
    />
  );
};

export { Toaster };

