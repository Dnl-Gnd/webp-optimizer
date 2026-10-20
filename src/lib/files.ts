import type { IncomingFile } from "./types";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

export function isImage(file: File) {
  return file.type.startsWith("image/") || IMAGE_EXT.test(file.name);
}

/** Carpeta relativa a partir de "carpeta/sub/archivo.png" → "carpeta/sub". */
export function dirname(path: string) {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "";
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  // readEntries devuelve los resultados por lotes (~100 en Chrome): hay que llamar hasta vaciarlo.
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (!batch.length) return resolve(all);
        all.push(...batch);
        next();
      }, reject);
    next();
  });
}

async function walk(entry: FileSystemEntry, out: IncomingFile[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    // fullPath es "/carpeta/sub/archivo.png"
    if (isImage(file)) out.push({ file, folder: dirname(entry.fullPath.replace(/^\//, "")) });
  } else if (entry.isDirectory) {
    const entries = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    for (const e of entries) await walk(e, out);
  }
}

/** Extrae imágenes de un drop, recorriendo carpetas completas si las hay. */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<IncomingFile[]> {
  const entries = Array.from(dt.items ?? [])
    .filter((i) => i.kind === "file")
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);

  if (!entries.length) {
    return Array.from(dt.files).filter(isImage).map((file) => ({ file, folder: "" }));
  }
  const out: IncomingFile[] = [];
  for (const e of entries) await walk(e, out);
  return out;
}

/** Desde un <input type="file">, con o sin webkitdirectory. */
export function filesFromInput(list: FileList): IncomingFile[] {
  return Array.from(list)
    .filter(isImage)
    .map((file) => ({ file, folder: dirname(file.webkitRelativePath || "") }));
}

/** Imágenes pegadas con Ctrl+V. Las capturas llegan como "image.png", así que se renombran. */
export function filesFromClipboard(data: DataTransfer): IncomingFile[] {
  const files = Array.from(data.files).filter(isImage);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return files.map((f, i) => {
    const generic = /^image\.(png|jpe?g|gif|webp)$/i.test(f.name) || !f.name;
    if (!generic) return { file: f, folder: "" };
    const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const name = `pegado-${stamp}${files.length > 1 ? `-${i + 1}` : ""}.${ext}`;
    return { file: new File([f], name, { type: f.type, lastModified: Date.now() }), folder: "" };
  });
}
