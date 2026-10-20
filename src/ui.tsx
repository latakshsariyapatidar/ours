import React, {
  useState,
  useRef,
  useEffect,
  useId,
  createContext,
  useContext,
} from "react";
import { X, Heart, Image as ImageIcon } from "lucide-react";
export const Notice = createContext<(s: string) => void>(() => {});
export function useNotice() {
  return useContext(Notice);
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="icon"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = false,
  ...rest
}: {
  label: string;
  name?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  [key: string]: any;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          id={id}
          name={name}
          type={type === "password" && show ? "text" : type}
          value={value}
          onChange={onChange}
          required={required}
          {...rest}
        />
        {type === "password" && (
          <button
            type="button"
            className="ghost reveal"
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );
}
export function NoteField({
  label,
  name,
  value,
  defaultValue,
  onChange,
  rows = 4,
}: {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="resize-none"
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        rows={rows}
        style={{ resize: "none" }}
      />
    </div>
  );
}
export function Select({
  label,
  children,
  ...props
}: {
  label: string;
  children: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}
export function ActionForm({
  children,
  onSubmit,
  submit = "Save changes",
}: {
  children: React.ReactNode;
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
  submit?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = useId();
  return (
    <form
      noValidate
      aria-describedby={error ? id : undefined}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        const invalid = Array.from(form.elements).find(
          (el) => el instanceof HTMLInputElement && !el.validity.valid,
        ) as HTMLInputElement | undefined;
        if (invalid) {
          setError(
            invalid.validity.tooShort
              ? "Use a longer value. Passwords need at least 12 characters."
              : "Complete all required fields with valid values.",
          );
          invalid.setAttribute("aria-invalid", "true");
          invalid.setAttribute("aria-describedby", id);
          invalid.focus();
          return;
        }
        setBusy(true);
        setError("");
        try {
          await onSubmit(
            Object.fromEntries(new FormData(form)) as Record<string, string>,
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <div id={id} className="form-error" role="alert">
        {error}
      </div>
      <button
        type="submit"
        className="primary"
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "Saving…" : submit}
      </button>
    </form>
  );
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="empty">
      <div className="paired-frames" aria-hidden="true">
        <div>
          <ImageIcon />
        </div>
        <div>
          <Heart />
        </div>
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}
export function Page({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · Ours`;
  }, [title]);
  return (
    <>
      <header className="page-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" /> Loading…
    </div>
  );
}
export function Failure({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="error-panel" role="alert">
      <p>{error.message}</p>
      <button onClick={retry}>Try again</button>
    </div>
  );
}
export function Confirm({
  title,
  body,
  action,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  action: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{body}</p>
      <ActionForm
        submit={action}
        onSubmit={async () => {
          await onConfirm();
          onClose();
        }}
      >
        <button type="button" autoFocus onClick={onClose}>
          Keep it
        </button>
      </ActionForm>
    </Modal>
  );
}
