/** Replaces personal identifiers so chat examples can be stored and reused safely. */
export function anonymize(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "<link>")
    .replace(/(?<![\w])(?:\+?\d[\d\s().-]{7,}\d)(?![\w])/g, "<nomor>");
}
