"use client";

import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { AdminShell } from "@/components/pulp/admin-shell";
import { usePulpAuthContext } from "@/components/pulp/auth-context";
import { usePulpGroups } from "@/components/pulp/use-pulp-groups";
import { useRequireAuth } from "@/components/pulp/use-require-auth";
import { usePulpUsers } from "@/components/pulp/use-pulp-users";
import { CreatePulpUserPayload, UpdatePulpUserPayload } from "@/services/pulp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxField, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";

export default function UsersListPage() {
  const { sessionUser, isLoading, isCheckingSession, hasSession, error, logout } =
    usePulpAuthContext();
  const isRedirectingToLogin = useRequireAuth({ hasSession, isCheckingSession });
  const { users, createUser, updateUser, deleteUser, changeUserPassword } =
    usePulpUsers(hasSession);
  const { groups } = usePulpGroups(hasSession);

  const createDialogTitleId = useId();
  const editDialogTitleId = useId();
  const passwordDialogTitleId = useId();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createIsStaff, setCreateIsStaff] = useState(false);
  const [createIsActive, setCreateIsActive] = useState(true);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editIsStaff, setEditIsStaff] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);

  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
  const [passwordUsername, setPasswordUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const resetEditForm = useCallback(() => {
    setEditUsername("");
    setEditFirstName("");
    setEditLastName("");
    setEditEmail("");
    setEditIsStaff(false);
    setEditIsActive(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingUserId(null);
    resetEditForm();
  }, [resetEditForm]);

  function startEditUser(user: (typeof users)[number]) {
    setEditingUserId(user.id);
    setEditUsername(user.username);
    setEditFirstName(user.first_name);
    setEditLastName(user.last_name);
    setEditEmail(user.email);
    setEditIsStaff(user.is_staff);
    setEditIsActive(user.is_active);
  }

  async function handleEditUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingUserId === null) {
      return;
    }

    const payload: UpdatePulpUserPayload = {
      username: editUsername,
      first_name: editFirstName,
      last_name: editLastName,
      email: editEmail,
      is_staff: editIsStaff,
      is_active: editIsActive,
    };

    const success = await updateUser(editingUserId, payload);
    if (success) {
      closeEditModal();
    }
  }

  async function removeUser(userId: number) {
    if (!window.confirm("Delete this user?")) {
      return;
    }

    await deleteUser(userId);
  }

  const resetPasswordForm = useCallback(() => {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  }, []);

  const closePasswordModal = useCallback(() => {
    setPasswordUserId(null);
    setPasswordUsername("");
    resetPasswordForm();
  }, [resetPasswordForm]);

  function startChangePassword(user: (typeof users)[number]) {
    setPasswordUserId(user.id);
    setPasswordUsername(user.username);
    resetPasswordForm();
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordUserId === null) {
      return;
    }

    if (newPassword.length === 0) {
      setPasswordError("Password is required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordError(null);

    const success = await changeUserPassword(passwordUserId, { password: newPassword });
    if (success) {
      closePasswordModal();
    }
  }

  const resetCreateForm = useCallback(() => {
    setCreateUsername("");
    setCreatePassword("");
    setCreateFirstName("");
    setCreateLastName("");
    setCreateEmail("");
    setCreateIsStaff(false);
    setCreateIsActive(true);
  }, []);

  function closeCreateModal() {
    setCreateModalOpen(false);
    resetCreateForm();
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreatePulpUserPayload = {
      username: createUsername,
      password: createPassword,
      first_name: createFirstName,
      last_name: createLastName,
      email: createEmail,
      is_staff: createIsStaff,
      is_active: createIsActive,
    };

    const success = await createUser(payload);
    if (!success) {
      return;
    }

    closeCreateModal();
  }

  const anyModalOpen =
    createModalOpen || editingUserId !== null || passwordUserId !== null;

  useEffect(() => {
    if (!anyModalOpen) {
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (passwordUserId !== null) {
        closePasswordModal();
      } else if (editingUserId !== null) {
        closeEditModal();
      } else {
        setCreateModalOpen(false);
        resetCreateForm();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [
    anyModalOpen,
    editingUserId,
    passwordUserId,
    closeEditModal,
    closePasswordModal,
    resetCreateForm,
  ]);

  return (
    <AdminShell
      title="Users List"
      description="View users from your connected Pulp server."
      hasSession={hasSession}
      sessionUser={sessionUser}
      isLoading={isLoading}
      usersCount={users.length}
      groupsCount={groups.length}
      error={error}
      onLogout={logout}
    >
      {isCheckingSession || isRedirectingToLogin ? (
        <Card>Checking existing session...</Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Users ({users.length})</CardTitle>
            <Button type="button" onClick={() => setCreateModalOpen(true)} disabled={isLoading}>
              Create user
            </Button>
          </div>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Username</TableHeaderCell>
                    <TableHeaderCell>Email</TableHeaderCell>
                    <TableHeaderCell>Staff</TableHeaderCell>
                    <TableHeaderCell>Active</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_staff ? "default" : "outline"}>
                          {user.is_staff ? "Staff" : "Standard"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "success" : "destructive"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => startEditUser(user)}
                            disabled={isLoading}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => startChangePassword(user)}
                            disabled={isLoading}
                          >
                            Change password
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                            onClick={() => removeUser(user.id)}
                            disabled={isLoading}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      )}

      {createModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={createDialogTitleId}
            className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id={createDialogTitleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              New user
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Create an account on your connected Pulp server.
            </p>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleCreateUser}>
              <FormField label="Username">
                <Input
                  value={createUsername}
                  onChange={(event) => setCreateUsername(event.target.value)}
                  required
                  autoComplete="username"
                />
              </FormField>

              <FormField label="Password">
                <Input
                  type="password"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </FormField>

              <FormField label="First name">
                <Input
                  value={createFirstName}
                  onChange={(event) => setCreateFirstName(event.target.value)}
                  autoComplete="given-name"
                />
              </FormField>

              <FormField label="Last name">
                <Input
                  value={createLastName}
                  onChange={(event) => setCreateLastName(event.target.value)}
                  autoComplete="family-name"
                />
              </FormField>

              <FormField label="Email" className="sm:col-span-2">
                <Input
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  autoComplete="email"
                />
              </FormField>

              <CheckboxField label="Is staff">
                <Input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 p-0 dark:border-zinc-700"
                  checked={createIsStaff}
                  onChange={(event) => setCreateIsStaff(event.target.checked)}
                />
              </CheckboxField>

              <CheckboxField label="Is active">
                <Input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 p-0 dark:border-zinc-700"
                  checked={createIsActive}
                  onChange={(event) => setCreateIsActive(event.target.checked)}
                />
              </CheckboxField>

              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={closeCreateModal} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create user"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingUserId !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={editDialogTitleId}
            className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id={editDialogTitleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Edit user
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Update account details on your connected Pulp server.
            </p>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleEditUser}>
              <FormField label="Username">
                <Input
                  value={editUsername}
                  onChange={(event) => setEditUsername(event.target.value)}
                  required
                  autoComplete="username"
                />
              </FormField>

              <FormField label="Email">
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  autoComplete="email"
                />
              </FormField>

              <FormField label="First name">
                <Input
                  value={editFirstName}
                  onChange={(event) => setEditFirstName(event.target.value)}
                  autoComplete="given-name"
                />
              </FormField>

              <FormField label="Last name">
                <Input
                  value={editLastName}
                  onChange={(event) => setEditLastName(event.target.value)}
                  autoComplete="family-name"
                />
              </FormField>

              <CheckboxField label="Is staff">
                <Input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 p-0 dark:border-zinc-700"
                  checked={editIsStaff}
                  onChange={(event) => setEditIsStaff(event.target.checked)}
                />
              </CheckboxField>

              <CheckboxField label="Is active">
                <Input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 p-0 dark:border-zinc-700"
                  checked={editIsActive}
                  onChange={(event) => setEditIsActive(event.target.checked)}
                />
              </CheckboxField>

              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={closeEditModal} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {passwordUserId !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePasswordModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={passwordDialogTitleId}
            className="max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2
              id={passwordDialogTitleId}
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Change password
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Set a new password for{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {passwordUsername}
              </span>
              .
            </p>
            <form className="mt-4 grid gap-3" onSubmit={handleChangePassword}>
              <FormField label="New password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  autoFocus
                />
              </FormField>

              <FormField label="Confirm new password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </FormField>

              {passwordError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
              ) : null}

              <div className="mt-1 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closePasswordModal}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Update password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
