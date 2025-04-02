export * from "./wallet";
export * from "./rest";
export * from "./ws";
export * from "./short-uuid";

export type Factory<T> = () => T;

export function singleton<T>(f: Factory<T>): Factory<T> {
  let instance: T;

  return () => {
    if (instance === undefined) instance = f();
    return instance;
  };
}
