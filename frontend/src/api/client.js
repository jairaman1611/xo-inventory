const BASE = "/api";

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

export const api = {
  status:        ()       => req("GET",  "/status"),
  authPassword:  (body)   => req("POST", "/auth/password",   body),
  authOtp:       (otp)    => req("POST", "/auth/otp",        { otp }),
  authToken:     (body)   => req("POST", "/auth/token",      body),
  disconnect:    ()       => req("POST", "/auth/disconnect"),
  inventory:     ()       => req("GET",  "/inventory"),
};
