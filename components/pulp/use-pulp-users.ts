"use client";

import { useCallback, useEffect, useState } from "react";
import { usePulpAuthContext } from "./auth-context";
import {
  ChangePulpUserPasswordPayload,
  CreatePulpUserPayload,
  PulpUser,
  UpdatePulpUserPayload,
} from "@/services/pulp/types";
import { pulpUserService } from "@/services/pulp/user-service";

export function usePulpUsers(enabled: boolean) {
  const { setError, setIsLoading } = usePulpAuthContext();
  const [users, setUsers] = useState<PulpUser[]>([]);

  const refreshUsers = useCallback(async () => {
    if (!enabled) {
      setUsers([]);
      return;
    }

    const nextUsers = await pulpUserService.list();
    setUsers(nextUsers);
  }, [enabled]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!enabled) {
        setUsers([]);
        return;
      }

      try {
        const nextUsers = await pulpUserService.list();
        if (active) {
          setUsers(nextUsers);
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : "Failed to load users.");
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [enabled, setError]);

  const runMutation = useCallback(
    async (mutate: () => Promise<{ ok: true } | { ok: false; detail: string }>) => {
      setError(null);
      setIsLoading(true);

      const result = await mutate();
      if (!result.ok) {
        setError(result.detail);
        setIsLoading(false);
        return false;
      }

      try {
        await refreshUsers();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to reload users.");
      } finally {
        setIsLoading(false);
      }

      return true;
    },
    [refreshUsers, setError, setIsLoading]
  );

  const createUser = useCallback(
    async (payload: CreatePulpUserPayload) => runMutation(() => pulpUserService.create(payload)),
    [runMutation]
  );

  const updateUser = useCallback(
    async (id: number, payload: UpdatePulpUserPayload) =>
      runMutation(() => pulpUserService.update(id, payload)),
    [runMutation]
  );

  const deleteUser = useCallback(
    async (id: number) => runMutation(() => pulpUserService.remove(id)),
    [runMutation]
  );

  const changeUserPassword = useCallback(
    async (id: number, payload: ChangePulpUserPasswordPayload) =>
      runMutation(() => pulpUserService.changePassword(id, payload)),
    [runMutation]
  );

  return {
    users,
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    changeUserPassword,
  };
}
