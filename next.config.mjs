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
  images: {
    remotePatterns: [
      ...(r2Pattern ? [r2Pattern] : []),
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
};

export default nextConfig;
