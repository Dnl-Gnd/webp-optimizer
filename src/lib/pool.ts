import type { OptimizeRequest, OptimizeResponse, Settings } from "./types";

type Job = {
  req: OptimizeRequest;
  resolve: (r: OptimizeResponse) => void;
};

/** Pool de Web Workers para procesar varias imágenes en paralelo. */
export class OptimizerPool {
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private pending = new Map<Worker, Job>();

  constructor(size = OptimizerPool.defaultSize()) {
    for (let i = 0; i < size; i++) this.idle.push(this.spawn());
  }

  static defaultSize() {
    const hc = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
    return Math.max(1, Math.min(4, hc - 1));
  }

  private spawn() {
    const w = new Worker(new URL("../workers/optimize.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<OptimizeResponse>) => this.finish(w, e.data);
    w.onerror = (e) => {
      const job = this.pending.get(w);
      if (job) this.finish(w, { id: job.req.id, ok: false, error: e.message || "Error en el worker" });
    };
    return w;
  }

  run(id: string, file: Blob, settings: Settings): Promise<OptimizeResponse> {
    return new Promise((resolve) => {
      this.queue.push({ req: { id, file, settings }, resolve });
      this.pump();
    });
  }

  /**
   * Cancela todo: vacía la cola y reinicia los workers ocupados, para no gastar
   * CPU en resultados que ya no sirven (importante con AVIF y tamaño objetivo).
   */
  cancelAll() {
    const cancelled = (job: Job) => job.resolve({ id: job.req.id, ok: false, error: "Cancelado", cancelled: true });
    this.queue.forEach(cancelled);
    this.queue = [];
    for (const [w, job] of this.pending) {
      w.terminate();
      cancelled(job);
      this.idle.push(this.spawn());
    }
    this.pending.clear();
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.pending.set(w, job);
      w.postMessage(job.req);
    }
  }

  private finish(w: Worker, res: OptimizeResponse) {
    const job = this.pending.get(w);
    if (!job) return; // worker ya cancelado
    this.pending.delete(w);
    this.idle.push(w);
    job.resolve(res);
    this.pump();
  }

  terminate() {
    this.idle.forEach((w) => w.terminate());
    this.pending.forEach((_, w) => w.terminate());
    this.idle = [];
    this.queue = [];
    this.pending.clear();
  }
}
