"use client";

import { clsx } from "clsx";
import { useConfigTabsContext } from "./SaveSettingsForm";

type TabKey = "identidad" | "contacto" | "ventas";

const TABS: { key: TabKey; label: string }[] = [
  { key: "identidad", label: "Identidad y marca" },
  { key: "contacto", label: "Contacto" },
  { key: "ventas", label: "Ventas y envío" },
];

export function ConfigTabs({
  identidad,
  contacto,
  ventas,
}: {
  identidad: React.ReactNode;
  contacto: React.ReactNode;
  ventas: React.ReactNode;
}) {
  // Estado de la pestaña activa vive en SaveSettingsForm (no acá), para que
  // el submit pueda cambiar de pestaña si encuentra un campo inválido oculto.
  const { activeTab, setActiveTab } = useConfigTabsContext();

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={clsx(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === t.key
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/*
        Los 3 paneles quedan siempre montados (solo se ocultan con `hidden`).
        Es un único <form> con un único submit: si un panel se desmontara al
        cambiar de tab, sus inputs desaparecerían de FormData y guardar desde
        otra pestaña borraría esos campos.

        `data-tab-panel` es cómo SaveSettingsForm ubica a qué pestaña
        pertenece un campo inválido (closest("[data-tab-panel]")) para
        cambiarse a esa pestaña antes de pedirle al navegador que lo enfoque.
      */}
      <div data-tab-panel="identidad" className={activeTab === "identidad" ? undefined : "hidden"}>
        {identidad}
      </div>
      <div data-tab-panel="contacto" className={activeTab === "contacto" ? undefined : "hidden"}>
        {contacto}
      </div>
      <div data-tab-panel="ventas" className={activeTab === "ventas" ? undefined : "hidden"}>
        {ventas}
      </div>
    </div>
  );
}
