// Dot thousands for a string of digits ("28456123" → "28.456.123"). Done by hand
// because the fixed `es` locale doesn't group four-digit numbers, and
// docs/design.md wants "9.500 km".
export function formatThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
