export let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
export const media = (id: string, kind = "thumbnail") =>
  `/api/media/${id}/${kind}`;
export const bytes = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(
    Number(n) / 1048576,
  ) + " MB";
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
export const status = (value: string) => value.replaceAll("_", " ");
