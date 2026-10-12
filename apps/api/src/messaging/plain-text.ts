/** WhatsApp and plain-text email show markdown symbols literally ("_booking_"), so they never belong in a draft. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ");
}

/** The recipient's name and gender are unknown, so an honorific ("Bapak", "Ibu") is a guess: use "Anda" instead. */
export function neutralHonorificChat(text: string): string {
  return text.replace(/\b(Mbak|Mas|Bapak|Ibu|Pak|Bu)\b(?!\s+[A-Z])/g, "Kak");
}

export function neutralHonorific(text: string): string {
  return text.replace(/\b(Bapak|Ibu|Pak|Bu)\b(?!\s+[A-Z])/g, "Anda");
}
