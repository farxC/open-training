import { MAX_FIT_BYTES } from "./types";

export async function pickFitFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".fit";
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        if (!/\.fit$/i.test(file.name)) throw new Error("Selecione um arquivo com extensão .fit.");
        if (file.size > MAX_FIT_BYTES) throw new Error("O arquivo FIT excede o limite de 20 MB.");
        resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      } catch (error) { reject(error); }
    };
    input.click();
  });
}
