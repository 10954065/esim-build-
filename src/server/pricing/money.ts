import Decimal from "decimal.js";
import { minorUnitExponent } from "@/lib/currency";

/**
 * Decimal-safe money helpers. Floating point is never used for monetary arithmetic.
 * Accepts strings, numbers, decimal.js and Prisma Decimal (anything with toString()).
 */

export type DecimalInput = Decimal.Value | { toString(): string };

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function dec(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return new D(value);
  if (typeof value === "string" || typeof value === "number") return new D(value);
  return new D(value.toString());
}

export function roundUpToMinor(value: DecimalInput, currency: string): Decimal {
  return dec(value).toDecimalPlaces(minorUnitExponent(currency), Decimal.ROUND_UP);
}

export function roundDownToMinor(value: DecimalInput, currency: string): Decimal {
  return dec(value).toDecimalPlaces(minorUnitExponent(currency), Decimal.ROUND_DOWN);
}

export function roundHalfUpToMinor(value: DecimalInput, currency: string): Decimal {
  return dec(value).toDecimalPlaces(minorUnitExponent(currency), Decimal.ROUND_HALF_UP);
}

/** Convert a major-unit amount to integer minor units (e.g. 12.34 USD → 1234n). Must be exact. */
export function toMinorUnits(value: DecimalInput, currency: string): bigint {
  const exp = minorUnitExponent(currency);
  const scaled = dec(value).times(new D(10).pow(exp));
  if (!scaled.isInteger()) throw new Error(`Amount ${dec(value).toString()} has more precision than ${currency} allows`);
  return BigInt(scaled.toFixed(0));
}

export function fromMinorUnits(minor: bigint | number, currency: string): Decimal {
  return new D(minor.toString()).div(new D(10).pow(minorUnitExponent(currency)));
}

/** Fixed-scale string suitable for Prisma Decimal(18,4) columns. */
export function toDbAmount(value: DecimalInput): string {
  return dec(value).toFixed(4);
}

export function toDisplayAmount(value: DecimalInput, currency: string): string {
  return dec(value).toFixed(minorUnitExponent(currency));
}

export function sum(values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new D(0));
}

export { Decimal };
