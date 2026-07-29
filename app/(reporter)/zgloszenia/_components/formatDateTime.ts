/**
 * Polish, short date-time. Kept as a helper (rather than an `Intl` inline) so
 * the format is uniform across list rows and feed entries.
 */
const formatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso: string): string {
  return formatter.format(new Date(iso));
}
