const SAFE = /^[0-9+\-*/%.()\s]+$/;

export function evalMath(expression: string): number {
  const cleaned = expression.trim();
  if (!cleaned || cleaned.length > 100) throw new Error("Пустое или слишком длинное выражение");
  if (!SAFE.test(cleaned)) throw new Error("В выражении разрешены только числа и + - * / % ( )");
  if (/[+\-*/%.]{2,}/.test(cleaned.replace(/\s+/g, "")) && !/\d\.\d/.test(cleaned)) {
    throw new Error("Недопустимая последовательность операторов");
  }
  const value: unknown = Function(`"use strict"; return (${cleaned});`)();
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Результат не число");
  return value;
}
