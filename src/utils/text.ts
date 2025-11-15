import DOMPurify from "dompurify";

export function toPlainText(html: string): string {
  const sanitized = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return sanitized.replace(/\s+/g, " ").trim();
}

export function previewText(html: string, length = 160): string {
  const text = toPlainText(html);
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length).trimEnd()}…`;
}
