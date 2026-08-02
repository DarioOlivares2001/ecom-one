"use client";

import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { EditorView } from "@codemirror/view";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Code, Eye } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const EXTENSIONS = [html(), EditorView.lineWrapping];

export default function QuillEditor({ value, onChange, placeholder }: Props) {
  const [mode, setMode] = useState<"html" | "preview">("html");

  return (
    <div>
      {/* ── Toggle ── */}
      <div className="mb-1 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setMode("html")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === "html"
              ? "bg-zinc-900 text-white"
              : "text-zinc-500 hover:bg-zinc-100"
          }`}
        >
          <Code className="h-3 w-3" />
          HTML
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === "preview"
              ? "bg-zinc-900 text-white"
              : "text-zinc-500 hover:bg-zinc-100"
          }`}
        >
          <Eye className="h-3 w-3" />
          Vista previa
        </button>
      </div>

      {/* ── CodeMirror ── */}
      {mode === "html" && (
        <CodeMirror
          value={value}
          onChange={(val) => onChange(val)}
          extensions={EXTENSIONS}
          theme={vscodeDark}
          minHeight="200px"
          maxHeight="400px"
          placeholder={placeholder}
          style={{ fontSize: 13, borderRadius: 6, overflow: "hidden" }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            autocompletion: true,
            indentOnInput: true,
          }}
        />
      )}

      {/* ── Preview ── */}
      {mode === "preview" && (
        <div
          className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-[var(--radius-sm)] border border-zinc-200 bg-white px-5 py-4 text-sm leading-relaxed text-zinc-800 [&_a]:underline [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{
            __html: value.trim() || '<p style="color:#a1a1aa">Sin contenido</p>',
          }}
        />
      )}
    </div>
  );
}
