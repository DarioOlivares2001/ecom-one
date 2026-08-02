import "dotenv/config";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";

dotenv.config({ path: ".env.local", override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missingEnvVars = [
  !SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : null,
  !SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : null,
].filter(Boolean);

if (missingEnvVars.length > 0) {
  console.error(`[audit-product-images] Faltan variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function shortText(value, max = 44) {
  const s = String(value ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function parsePngDimensions(buf) {
  if (buf.length < 24) return null;
  const sig = "89504e470d0a1a0a";
  if (buf.subarray(0, 8).toString("hex") !== sig) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height, format: "png" };
}

function parseJpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    const blockLen = buf.readUInt16BE(offset + 2);
    const isSof =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;
    if (isSof && offset + 8 < buf.length) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height, format: "jpg" };
    }
    if (blockLen < 2) break;
    offset += 2 + blockLen;
  }
  return null;
}

function parseWebpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.subarray(0, 4).toString("ascii") !== "RIFF") return null;
  if (buf.subarray(8, 12).toString("ascii") !== "WEBP") return null;
  const chunk = buf.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X" && buf.length >= 30) {
    const width = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
    const height = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
    return { width, height, format: "webp" };
  }
  if (chunk === "VP8 " && buf.length >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height, format: "webp" };
  }
  if (chunk === "VP8L" && buf.length >= 25) {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height, format: "webp" };
  }
  return null;
}

function parseDimensions(buf) {
  return parsePngDimensions(buf) || parseJpegDimensions(buf) || parseWebpDimensions(buf);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

async function inspectImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const contentLength = Number(res.headers.get("content-length") ?? "0");
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    const estimatedBytes = contentLength > 0 ? contentLength : buf.length;
    const dims = parseDimensions(buf);

    return {
      ok: true,
      estimatedBytes,
      estimatedHuman: formatBytes(estimatedBytes),
      width: dims?.width ?? "",
      height: dims?.height ?? "",
      format: dims?.format ?? "",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

async function main() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,images")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[audit-product-images] Error consultando productos:", error.message);
    process.exit(1);
  }

  const rows = [];
  const imageIndexByProduct = new Map();
  for (const product of data ?? []) {
    const images = Array.isArray(product.images) ? product.images : [];
    for (const url of images) {
      const nextIdx = (imageIndexByProduct.get(product.id) ?? 0) + 1;
      imageIndexByProduct.set(product.id, nextIdx);

      const info = await inspectImage(url);
      rows.push({
        product_id: product.id,
        product_name: product.name,
        image_index: nextIdx,
        url,
        estimated_bytes: info.ok ? info.estimatedBytes : "",
        estimated_size: info.ok ? info.estimatedHuman : "",
        width: info.ok ? info.width : "",
        height: info.ok ? info.height : "",
        format: info.ok ? info.format : "",
        over_500kb: false,
        over_1200px: false,
        needs_optimization: false,
        recommended_action: "OK",
        error: info.ok ? "" : info.error,
      });
      const row = rows[rows.length - 1];
      if (info.ok) {
        const over500 = Number(info.estimatedBytes) > 500 * 1024;
        const over1200 = Number(info.width || 0) > 1200;
        row.over_500kb = over500;
        row.over_1200px = over1200;
        row.needs_optimization = over500 || over1200;
        row.recommended_action = over500 && over1200
          ? "COMPRESS_AND_RESIZE"
          : over500
            ? "COMPRESS"
            : over1200
              ? "RESIZE"
              : "OK";
      }
    }
  }

  rows.sort((a, b) => Number(b.estimated_bytes || 0) - Number(a.estimated_bytes || 0));

  const tableRows = rows.map((r) => {
    const needs = !!r.needs_optimization;
    return {
      estado: needs ? "⚠️ OPTIMIZAR" : "✅ OK",
      producto: shortText(r.product_name, 34),
      "imagen #": r.image_index,
      peso: r.estimated_size || "-",
      dimensiones:
        r.width && r.height ? `${r.width} x ${r.height}` : "-",
      formato: r.format || "-",
      accion: r.recommended_action || "OK",
    };
  });

  console.log("\n=== Auditoría de Imágenes de Productos ===");
  console.table(tableRows);

  const header = [
    "product_id",
    "product_name",
    "image_index",
    "url",
    "estimated_bytes",
    "estimated_size",
    "width",
    "height",
    "format",
    "over_500kb",
    "over_1200px",
    "needs_optimization",
    "recommended_action",
    "error",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.product_id,
        r.product_name,
        r.image_index,
        r.url,
        r.estimated_bytes,
        r.estimated_size,
        r.width,
        r.height,
        r.format,
        r.over_500kb,
        r.over_1200px,
        r.needs_optimization,
        r.recommended_action,
        r.error,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ].join("\n");

  const outPath = "tmp-product-images-audit.csv";
  await writeFile(outPath, csv, "utf8");

  const totalImages = rows.length;
  const okCount = rows.filter((r) => !r.needs_optimization).length;
  const optimizeCount = rows.filter((r) => !!r.needs_optimization).length;
  const totalBytes = rows.reduce((acc, r) => acc + Number(r.estimated_bytes || 0), 0);
  const avgBytes = totalImages > 0 ? totalBytes / totalImages : 0;
  const heaviest = rows[0];

  console.log("\n=== Resumen ===");
  console.log(`Total imágenes: ${totalImages}`);
  console.log(`✅ OK: ${okCount}`);
  console.log(`⚠️ Requieren optimización: ${optimizeCount}`);
  console.log(`Peso promedio: ${formatBytes(avgBytes)}`);
  if (heaviest) {
    console.log(
      `Imagen más pesada: ${heaviest.estimated_size || "-"} | ${heaviest.product_name} | #${heaviest.image_index} | ${heaviest.url}`
    );
  }
  console.log(`[audit-product-images] Reporte CSV generado: ${outPath}`);
}

main().catch((err) => {
  console.error("[audit-product-images] Error inesperado:", err);
  process.exit(1);
});

