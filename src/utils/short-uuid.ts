import { v4 as uuid } from "uuid";

function toShortUuid(id: string) {
  return id.replace(/-/g, "");
}

export function generateShortUuid() {
  return toShortUuid(uuid());
}

const orderIdV2Day = new Date("2025-07-24T00:00:00Z");

export function generateOrderIdV2() {
  const days = Math.floor((Date.now() - orderIdV2Day.getTime()) / (1000 * 60 * 60 * 24));
  return `${String(days).padStart(5, "0")}:${toShortUuid(uuid()).slice(0, 26)}`;
}
