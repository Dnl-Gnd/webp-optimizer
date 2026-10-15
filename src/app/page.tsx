import Optimizer from "@/components/Optimizer";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Optimizador WebP</h1>
        <p className="max-w-2xl text-neutral-400">
          Convierte PNG, JPG y más a WebP, reduce su peso sin perder calidad visible y compara el resultado antes de descargar.
        </p>
      </header>
      <Optimizer />
    </main>
  );
}
