export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
}

function emit(type: ToastType, options: ToastOptions | string) {
  const detail =
    typeof options === "string" ? { title: options } : options;
  window.dispatchEvent(new CustomEvent("ha-toast", { detail: { type, ...detail } }));
}

export const toast = {
  success: (options: ToastOptions | string) => emit("success", options),
  error: (options: ToastOptions | string) => emit("error", options),
  info: (options: ToastOptions | string) => emit("info", options),
  warning: (options: ToastOptions | string) => emit("warning", options),
};
