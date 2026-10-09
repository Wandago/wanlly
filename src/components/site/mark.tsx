import { SpinMark } from "../spin-mark";

/** The Wanlly app icon: the orange spin on an ink tile (or the bare spin when `inverted`). */
export function Mark({ size = 26, inverted = false }: { size?: number; id?: string; inverted?: boolean }) {
  return inverted ? <SpinMark size={size} /> : <SpinMark size={size} tile />;
}
