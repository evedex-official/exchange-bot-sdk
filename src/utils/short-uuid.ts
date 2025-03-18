import { v4 as uuid } from "uuid";

function toShortUuid(id: string) {
  return id.replace(/-/g, "");
}

export function generateShortUuid() {
  return toShortUuid(uuid());
}
