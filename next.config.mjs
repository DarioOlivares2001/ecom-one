/** @type {import('next').NextConfig} */

// R2_PUBLIC_URL puede ser un dominio propio (recomendado en producción) o el
// subdominio *.r2.dev que Cloudflare da por defecto. Se agrega dinámicamente
// a remotePatterns solo si está configurado, para no romper el build cuando
// R2 todavía no tiene credenciales (ver R2_SETUP.md).
function r2RemotePattern() {
  const raw = process.env.R2_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      port: "",
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const r2Pattern = r2RemotePattern();

const nextConfig = {
  // Espejo público de R2_PUBLIC_URL (ya es una URL pública por diseño, ver
  // .env.example) para que lib/images/isAllowedImageSrc.ts pueda validar el
  // host de una imagen tanto en Server como en Client Components, sin
  // exponer ninguna variable nueva ni secreta.
  env: {
    NEXT_PUBLIC_R2_PUBLIC_URL: process.env.R2_PUBLIC_URL?.trim() || "",
  },
  images: {
    remotePatterns: [...(r2Pattern ? [r2Pattern] : [])],
  },
};

export default nextConfig;
