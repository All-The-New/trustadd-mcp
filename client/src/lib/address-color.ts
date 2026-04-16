/** Map an address to a procedural HSL color used for avatar fallbacks and gradients. */
export function addressToColor(address: string | null | undefined, saturation = 55, lightness = 50): string {
  if (!address) return `hsl(0, 0%, ${lightness}%)`;
  const hash = address.slice(2, 8);
  const hue = parseInt(hash, 16) % 360;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Two hues derived from an address — used for banner radial gradients. */
export function addressToGradientPair(address: string | null | undefined): { a: string; b: string } {
  if (!address) return { a: "#1a1f2e", b: "#12151f" };
  const hash = address.slice(2, 14);
  const h1 = parseInt(hash.slice(0, 6), 16) % 360;
  const h2 = (h1 + 40) % 360;
  return {
    a: `hsl(${h1}, 40%, 22%)`,
    b: `hsl(${h2}, 35%, 12%)`,
  };
}
