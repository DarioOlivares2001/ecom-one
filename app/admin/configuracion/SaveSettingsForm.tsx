"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { toast } from "@/components/ui/Toast";

type SaveResult = { error?: string; success?: boolean };

type ConfigTabsContextValue = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

const ConfigTabsContext = createContext<ConfigTabsContextValue | null>(null);

/** Usado por ConfigTabs para leer/cambiar la pestaña activa desde afuera (ver validación en handleSubmit). */
export function useConfigTabsContext(): ConfigTabsContextValue {
  const ctx = useContext(ConfigTabsContext);
  if (!ctx) {
    throw new Error("useConfigTabsContext debe usarse dentro de <SaveSettingsForm>");
  }
  return ctx;
}

const DEFAULT_TAB = "identidad";

export function SaveSettingsForm({
  action,
  children,
}: {
  action: (formData: FormData) => Promise<SaveResult>;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const pendingFocusRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);

  // Cuando cambiamos de pestaña para mostrar un campo inválido, recién acá
  // (después de que React sacó el `hidden` del panel) el navegador puede
  // enfocarlo y mostrar su mensaje — antes de esto el panel seguía oculto.
  useEffect(() => {
    const el = pendingFocusRef.current;
    if (!el) return;
    pendingFocusRef.current = null;
    el.focus();
    el.reportValidity();
  }, [activeTab]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    // El <form> tiene noValidate: validamos nosotros para poder cambiar de
    // pestaña ANTES de que el navegador intente reportar el error. Si no
    // hiciéramos esto, un campo inválido en una pestaña oculta (display:none)
    // no es focuseable y el navegador cancela el submit sin avisar nada.
    const controls = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input, select, textarea"
      )
    );
    const invalidField = controls.find((el) => el.willValidate && !el.checkValidity());

    if (invalidField) {
      const panel = invalidField.closest("[data-tab-panel]");
      const tabKey = panel?.getAttribute("data-tab-panel");

      if (tabKey && tabKey !== activeTab) {
        pendingFocusRef.current = invalidField;
        setActiveTab(tabKey);
      } else {
        invalidField.focus();
        invalidField.reportValidity();
      }

      toast.error("Hay un campo con un valor inválido. Te llevamos a la pestaña para que lo corrijas.");
      return;
    }

    const formData = new FormData(form);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Configuración guardada correctamente.");
      }
    });
  }

  return (
    <ConfigTabsContext.Provider value={{ activeTab, setActiveTab }}>
      <form
        id="store-settings-form"
        noValidate
        onSubmit={handleSubmit}
        className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        {children}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </form>
    </ConfigTabsContext.Provider>
  );
}
