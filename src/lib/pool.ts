import type { OptimizeRequest, OptimizeResponse, Settings } from "./types";

type Job = {
  req: OptimizeRequest;
  resolve: (r: OptimizeResponse) => void;
};

/** Pool simple de Web Workers para procesar varias imágenes en paralelo. */
export class OptimizerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private pending = new Map<Worker, Job>();

  constructor(size = OptimizerPool.defaultSize()) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL("../workers/optimize.worker.ts", import.meta.url), {
        type: "module",
      });
      w.onmessage = (e: MessageEvent<OptimizeResponse>) => this.finish(w, e.data);
      w.onerror = (e) => {
        const job = this.pending.get(w);
        if (job) this.finish(w, { id: job.req.id, ok: false, error: e.message || "Error en el worker" });
      };
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  static defaultSize() {
    const hc = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
    return Math.max(1, Math.min(4, hc - 1));
  }

  run(id: string, file: Blob, settings: Settings): Promise<OptimizeResponse> {
    return new Promise((resolve) => {
      this.queue.push({ req: { id, file, settings }, resolve });
      this.pump();
    });
  }

  /** Descarta trabajos en cola que aún no empezaron (p. ej. al cambiar ajustes). */
  clearQueue() {
    this.queue = [];
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
    this.pending.delete(w);
    this.idle.push(w);
    job?.resolve(res);
    this.pump();
  }

  terminate() {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.pending.clear();
  }
}
