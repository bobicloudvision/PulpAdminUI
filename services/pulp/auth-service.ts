import { readApiDetail } from "./http";
import { API_BASE } from "@/lib/base-path";

const API_PATHS = {
  login: `${API_BASE}/login`,
  logout: `${API_BASE}/logout`,
} as const;

export const pulpAuthService = {
  async getSessionUser(): Promise<string | null> {
    const response = await fetch(API_PATHS.login);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { username: string };
    return payload.username;
  },

  async login(
    username: string,
    password: string
  ): Promise<{ ok: true; username: string } | { ok: false; detail: string }> {
    const response = await fetch(API_PATHS.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      return {
        ok: false,
        detail: await readApiDetail(response),
      };
    }

    const payload = (await response.json()) as { username: string };
    return {
      ok: true,
      username: payload.username,
    };
  },

  async logout(): Promise<void> {
    await fetch(API_PATHS.logout, { method: "POST" });
  },
};
