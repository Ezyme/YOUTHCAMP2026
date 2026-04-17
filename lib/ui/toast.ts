import { toast } from "sonner";

/**
 * Single-slot toast helpers — only one error and one success toast is ever
 * visible at once. Firing a new message **replaces** the previous one in place
 * by reusing a fixed sonner id. Keep copy short and action-oriented.
 */
const ERR_ID = "err";
const OK_ID = "ok";
const INFO_ID = "info";
const WARN_ID = "warn";

type ToastOptions = {
  /** Override the default duration (ms). */
  duration?: number;
  /** Optional short description shown under the title. */
  description?: string;
};

export function showError(message: string, opts?: ToastOptions): void {
  toast.error(message, {
    id: ERR_ID,
    duration: opts?.duration ?? 4000,
    description: opts?.description,
  });
}

export function showSuccess(message: string, opts?: ToastOptions): void {
  toast.success(message, {
    id: OK_ID,
    duration: opts?.duration ?? 3000,
    description: opts?.description,
  });
}

export function showInfo(message: string, opts?: ToastOptions): void {
  toast(message, {
    id: INFO_ID,
    duration: opts?.duration ?? 2500,
    description: opts?.description,
  });
}

export function showWarning(message: string, opts?: ToastOptions): void {
  toast.warning(message, {
    id: WARN_ID,
    duration: opts?.duration ?? 4000,
    description: opts?.description,
  });
}

export function dismissToasts(): void {
  toast.dismiss(ERR_ID);
  toast.dismiss(OK_ID);
  toast.dismiss(INFO_ID);
  toast.dismiss(WARN_ID);
}
