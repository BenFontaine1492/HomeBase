/*
 * Colour maths for checking contrast (WCAG 2). Colours are '#RRGGBB' strings, as in the
 * theme definitions (plugins/themes.ts).
 */

interface Rgb {
  red: number
  green: number
  blue: number
}

function rgbOf(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16)
  return { red: (value >> 16) & 0xff, green: (value >> 8) & 0xff, blue: value & 0xff }
}

function hexPart(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, '0').toUpperCase()
}

/** One channel (0–255) on the linear scale of the luminance formula. */
function linear(channel: number): number {
  const value = channel / 255
  return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** Relative luminance (WCAG 2), 0 for black to 1 for white. */
function luminance(hex: string): number {
  const { red, green, blue } = rgbOf(hex)
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
}

/** Contrast ratio of two colours, from 1 (the same) to 21 (black on white). Text needs 4.5. */
export function contrastRatio(first: string, second: string): number {
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** `color` at `opacity` over `background`, e.g. text in a medium emphasis. */
export function blend(color: string, opacity: number, background: string): string {
  const front = rgbOf(color)
  const back = rgbOf(background)
  const mix = (key: keyof Rgb): string => hexPart(front[key] * opacity + back[key] * (1 - opacity))
  return `#${mix('red')}${mix('green')}${mix('blue')}`
}
