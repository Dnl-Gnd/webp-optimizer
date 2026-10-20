import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { webpack }) {
    // Los códecs AVIF y OxiPNG traen variantes multihilo que solo funcionan con
    // cross-origin isolation (SharedArrayBuffer). Esta app no la usa, así que nunca
    // se ejecutan; pero webpack igual las empaqueta y generan dependencias circulares
    // entre chunks que rompen el build de forma intermitente. Se reemplazan por la
    // versión de un hilo.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/avif_enc_mt\.js$/, (res: { request: string }) => {
        res.request = res.request.replace("avif_enc_mt.js", "avif_enc.js");
      }),
      new webpack.NormalModuleReplacementPlugin(/pkg-parallel[\\/]squoosh_oxipng\.js$/, (res: { request: string }) => {
        res.request = res.request.replace("pkg-parallel", "pkg");
      }),
    );
    return config;
  },
};

export default nextConfig;
