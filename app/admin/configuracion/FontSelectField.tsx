"use client";

import { useState } from "react";
import { resolveFontCssVar } from "@/lib/fonts/registry";

type FontSelectFieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  options: string[];
  helperText?: string;
  previewText?: string;
};

export function FontSelectField({
  label,
  name,
  defaultValue,
  options,
  helperText,
  previewText = "Vista previa: El rápido zorro marrón salta sobre el perro perezoso.",
}: FontSelectFieldProps) {
  const safeDefault = options.includes(defaultValue) ? defaultValue : options[0];
  const [selected, setSelected] = useState(safeDefault);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        name={name}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900"
      >
        {options.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>
      {helperText ? <span className="text-xs text-zinc-500">{helperText}</span> : null}
      <div
        className="mt-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
        style={{ fontFamily: resolveFontCssVar(selected, "system-ui, sans-serif") }}
      >
        {previewText}
      </div>
    </label>
  );
}
