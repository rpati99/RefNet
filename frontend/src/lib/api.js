const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}