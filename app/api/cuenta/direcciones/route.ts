import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";

export const runtime = "nodejs";
type AdminClient = ReturnType<typeof createAdminClient>;
type ClienteRow = {
  id: string | number;
};
type ClienteDireccionInsert = {
  cliente_id: string;
  nombre: string;
  telefono: string | null;
  direccion: string;
  comuna: string;
  region: string;
  referencia?: string | null;
  is_default: boolean;
};

type ClienteDireccionUpdate = {
  is_default?: boolean;
};

type ClienteDireccionRow = ClienteDireccionInsert & {
  id: string | number;
  created_at?: string;
  updated_at?: string;
};
type AddressPayload = {
  nombre?: string;
  telefono?: string;
  direccion?: string;
  comuna?: string;
  region?: string;
  referencia?: string;
  principal?: boolean;
  is_default?: boolean;
};

function logSupabaseError(context: string, error: unknown) {
  const e = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };
  console.error(`[cuenta-direcciones] ${context}`, {
    message: e?.message,
    details: e?.details,
    hint: e?.hint,
    code: e?.code,
  });
}

const clienteDireccionesTable = (admin: AdminClient) =>
  admin.from("cliente_direcciones") as unknown as {
    update: (values: ClienteDireccionUpdate) => {
      eq: (column: string, value: string | number | boolean) => Promise<{ error: unknown }>;
    };
    insert: (values: ClienteDireccionInsert) => {
      select: (columns: string) => {
        single: () => Promise<{ data: ClienteDireccionRow | null; error: unknown }>;
      };
    };
    select: (columns: string) => {
      eq: (column: string, value: string | number | boolean) => {
        order: (
          column: string,
          options?: { ascending?: boolean }
        ) => {
          order: (
            column: string,
            options?: { ascending?: boolean }
          ) => Promise<{ data: ClienteDireccionRow[] | null; error: unknown }>;
        };
      };
    };
  };

const postSchema = z.object({
  nombre: z.string().min(1).max(120),
  direccion: z.string().min(3).max(300),
  comuna: z.string().min(1).max(120),
  region: z.string().min(1).max(120),
  referencia: z.string().max(300).optional().nullable(),
  telefono: z.string().max(40).optional().nullable(),
  is_default: z.boolean().optional(),
});

async function getClienteId(admin: AdminClient, email: string): Promise<string | null> {
  const result = await admin
    .from("clientes")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  const data = result.data as ClienteRow | null;
  const error = result.error;
  if (error || !data?.id) return null;
  return String(data.id);
}

export async function GET() {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const email = normalizeClienteEmail(session.email);
  const admin = createAdminClient();
  const clienteId = await getClienteId(admin, email);
  if (!clienteId) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const { data, error } = await clienteDireccionesTable(admin)
    .select("id,nombre,direccion,comuna,region,referencia,telefono,is_default,created_at,updated_at")
    .eq("cliente_id", clienteId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    logSupabaseError("list", error);
    return NextResponse.json({ error: "No se pudieron cargar las direcciones." }, { status: 500 });
  }

  return NextResponse.json({ direcciones: data ?? [] });
}

export async function POST(request: Request) {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const email = normalizeClienteEmail(session.email);
  let body: AddressPayload;
  try {
    body = (await request.json()) as AddressPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = postSchema.safeParse({
    ...body,
    is_default:
      typeof body.principal === "boolean" ? body.principal : typeof body.is_default === "boolean" ? body.is_default : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const clienteId = await getClienteId(admin, email);
  if (!clienteId) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const d = parsed.data;
  const isDefault = Boolean(d.is_default);

  if (isDefault) {
    await clienteDireccionesTable(admin).update({ is_default: false }).eq("cliente_id", String(clienteId));
  }

  const telefonoVal = d.telefono?.trim() || null;

  const { data: inserted, error: insErr } = await clienteDireccionesTable(admin)
    .insert({
      cliente_id: String(clienteId),
      nombre: d.nombre.trim(),
      direccion: d.direccion.trim(),
      comuna: d.comuna.trim(),
      region: d.region.trim(),
      referencia: d.referencia?.trim() || null,
      telefono: telefonoVal,
      is_default: isDefault,
    })
    .select("id")
    .single();

  if (insErr) {
    logSupabaseError("insert", insErr);
    return NextResponse.json({ error: "No se pudo crear la dirección." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, id: inserted?.id });
}
