"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Heart, Package, Percent, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "cuenta_bienvenida_payload";

type StoragePayload = {
  nombre?: string;
  email?: string;
};

const benefits = [
  { icon: Percent, text: "Ofertas especiales para clientes registrados" },
  { icon: Zap, text: "Compra más rápida" },
  { icon: Package, text: "Seguimiento de tus pedidos" },
  { icon: Heart, text: "Beneficios para tus gatitos" },
];

function CheckHero() {
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 ring-[10px] ring-green-100/90"
    >
      <Check className="h-10 w-10 text-emerald-600" strokeWidth={2.5} aria-hidden />
    </motion.div>
  );
}

export function BienvenidaClient({
  storeName,
  queryNombre,
  queryEmail,
  recoveryHint = false,
}: {
  storeName: string;
  queryNombre?: string;
  queryEmail?: string;
  recoveryHint?: boolean;
}) {
  const [merged, setMerged] = useState<StoragePayload | null>(null);

  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as StoragePayload;
      if (d && typeof d === "object") {
        setMerged({
          nombre: typeof d.nombre === "string" ? d.nombre : undefined,
          email: typeof d.email === "string" ? d.email : undefined,
        });
      }
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignorar JSON inválido
    }
  }, []);

  const displayNombre = useMemo(() => {
    const fromStorage = merged?.nombre?.trim();
    const fromQuery = queryNombre?.trim();
    const n = (fromStorage || fromQuery || "").trim();
    return n.length ? n : null;
  }, [merged, queryNombre]);

  const displayEmail = useMemo(() => {
    const fromStorage = merged?.email?.trim();
    const fromQuery = queryEmail?.trim();
    return (fromStorage || fromQuery || "").trim() || null;
  }, [merged, queryEmail]);

  const brand = (storeName || "la tienda").trim() || "la tienda";
  const greeting = displayNombre ? `Hola, ${displayNombre}.` : "Bienvenido/a.";

  return (
    <main className="flex min-h-[78vh] flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-zinc-200/90 bg-white px-6 py-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:px-10 sm:py-12">
        <CheckHero />

        <div className="mt-8 text-center">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-3xl">
            ¡Ya eres parte de {brand}!
          </h1>
          <p className="mt-3 text-sm font-medium text-zinc-600 sm:text-base" data-clarity-mask="true">
            {greeting}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
            Desde ahora podrás acceder a beneficios exclusivos, repetir compras más rápido y guardar tus datos para
            futuras compras.
          </p>
          {displayEmail ? (
            <p className="mt-3 text-xs text-zinc-400" data-clarity-mask="true">
              Cuenta asociada a <span className="font-medium text-zinc-500">{displayEmail}</span>
            </p>
          ) : null}
          {recoveryHint ? (
            <div className="mt-5 rounded-[var(--radius-md)] border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-left text-sm leading-relaxed text-emerald-950">
              <p className="font-semibold text-emerald-900">Encontramos datos de compras anteriores</p>
              <p className="mt-1 text-emerald-900/90">
                Revisa tu perfil y dirección en «Mi cuenta» para confirmarlos y agilizar tu próxima compra.
              </p>
            </div>
          ) : null}
        </div>

        <ul className="mt-8 space-y-3.5 text-left">
          {benefits.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex gap-3 rounded-[var(--radius-md)] border border-zinc-100 bg-zinc-50/80 px-3.5 py-3 text-sm text-zinc-800"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-primary)] shadow-sm ring-1 ring-zinc-200/80">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="pt-0.5 leading-snug">{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/cuenta" className="w-full sm:w-auto sm:min-w-[200px]">
            <Button variant="primary" size="lg" fullWidth className="sm:px-8">
              Ir a mi cuenta
            </Button>
          </Link>
          <Link href="/productos" className="w-full sm:w-auto sm:min-w-[200px]">
            <Button variant="secondary" size="lg" fullWidth className="sm:px-8">
              Seguir comprando
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
