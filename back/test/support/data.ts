// Os dados oficiais do desafio (data/*.json). No container de teste vêm montados em DATA_DIR;
// localmente, ficam na raiz do repositório, ao lado de back/.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR =
  process.env.DATA_DIR ?? fileURLToPath(new URL('../../../data', import.meta.url));

export async function readDataFile<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(join(DATA_DIR, file), 'utf8')) as T;
}
