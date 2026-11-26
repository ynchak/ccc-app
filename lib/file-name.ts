/** Убирает расширение табличного файла, не трогая точки в названии. */
export function stripTableFileExtension(fileName: string): string {
  return fileName.replace(/\.(csv|xlsx|xls)$/i, "");
}
