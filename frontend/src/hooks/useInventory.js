import { useState, useCallback } from "react";
import { api } from "../api/client";

export function useInventory() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [fetchedAt, setFetchedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const inv = await api.inventory();
      setData(inv);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchedAt, load };
}

export function useAuth() {
  const [status,  setStatus]  = useState("disconnected");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    const s = await api.status().catch(() => ({ status: "disconnected" }));
    setStatus(s.status);
    return s.status;
  }, []);

  const connectPassword = useCallback(async (host, username, password, verify_ssl = false) => {
    setLoading(true); setError("");
    try {
      const r = await api.authPassword({ host, username, password, verify_ssl });
      setStatus(r.status);
      return r.status;
    } catch (e) { setError(e.message); return "error"; }
    finally { setLoading(false); }
  }, []);

  const submitOtp = useCallback(async (otp) => {
    setLoading(true); setError("");
    try {
      const r = await api.authOtp(otp);
      setStatus(r.status);
      return r.status;
    } catch (e) { setError(e.message); return "error"; }
    finally { setLoading(false); }
  }, []);

  const connectToken = useCallback(async (host, token, verify_ssl = false) => {
    setLoading(true); setError("");
    try {
      const r = await api.authToken({ host, token, verify_ssl });
      setStatus(r.status);
      return r.status;
    } catch (e) { setError(e.message); return "error"; }
    finally { setLoading(false); }
  }, []);

  const disconnect = useCallback(async () => {
    await api.disconnect().catch(() => {});
    setStatus("disconnected");
    setError("");
  }, []);

  return { status, error, loading, checkStatus, connectPassword, submitOtp, connectToken, disconnect };
}
