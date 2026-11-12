/**
 * Object types a Pulp role can be scoped to, keyed by Django "<app_label>.<model>".
 * Role permissions look like "<app_label>.<action>_<model>" (e.g. "rpm.modify_content_rpmrepository"),
 * so the model a role applies to can be derived from its permissions.
 *
 * `path` is the Pulp list endpoint (relative to PULP_BASE_URL) used to offer concrete objects.
 * This map is also the server-side whitelist for /api/pulp/role-objects.
 */
export type RoleObjectTypeConfig = {
  label: string;
  path: string;
  /** Field used to sort and label objects; omitted when the model has no `name`. */
  nameField?: "name";
};

export const ROLE_OBJECT_TYPES = {
  "rpm.rpmrepository": { label: "RPM repository", path: "/repositories/rpm/rpm/", nameField: "name" },
  "rpm.rpmdistribution": { label: "RPM distribution", path: "/distributions/rpm/rpm/", nameField: "name" },
  "rpm.rpmremote": { label: "RPM remote", path: "/remotes/rpm/rpm/", nameField: "name" },
  "rpm.ulnremote": { label: "ULN remote", path: "/remotes/rpm/uln/", nameField: "name" },
  "rpm.rpmalternatecontentsource": { label: "RPM ACS", path: "/acs/rpm/rpm/", nameField: "name" },

  "deb.aptrepository": { label: "APT repository", path: "/repositories/deb/apt/", nameField: "name" },
  "deb.aptdistribution": { label: "APT distribution", path: "/distributions/deb/apt/", nameField: "name" },
  "deb.aptremote": { label: "APT remote", path: "/remotes/deb/apt/", nameField: "name" },

  "file.filerepository": { label: "File repository", path: "/repositories/file/file/", nameField: "name" },
  "file.filedistribution": { label: "File distribution", path: "/distributions/file/file/", nameField: "name" },
  "file.fileremote": { label: "File remote", path: "/remotes/file/file/", nameField: "name" },
  "file.filealternatecontentsource": { label: "File ACS", path: "/acs/file/file/", nameField: "name" },

  "container.containerrepository": {
    label: "Container repository",
    path: "/repositories/container/container/",
    nameField: "name",
  },
  "container.containerpushrepository": {
    label: "Container push repository",
    path: "/repositories/container/container-push/",
    nameField: "name",
  },
  "container.containerdistribution": {
    label: "Container distribution",
    path: "/distributions/container/container/",
    nameField: "name",
  },
  "container.containerremote": {
    label: "Container remote",
    path: "/remotes/container/container/",
    nameField: "name",
  },

  "python.pythonrepository": { label: "Python repository", path: "/repositories/python/python/", nameField: "name" },
  "python.pythondistribution": { label: "Python distribution", path: "/distributions/python/pypi/", nameField: "name" },
  "python.pythonremote": { label: "Python remote", path: "/remotes/python/python/", nameField: "name" },

  "core.group": { label: "Group", path: "/groups/", nameField: "name" },
  "core.domain": { label: "Domain", path: "/domains/", nameField: "name" },
  "core.upload": { label: "Upload", path: "/uploads/" },
  "core.rbaccontentguard": { label: "RBAC content guard", path: "/contentguards/core/rbac/", nameField: "name" },
  "core.compositecontentguard": {
    label: "Composite content guard",
    path: "/contentguards/core/composite/",
    nameField: "name",
  },
  "core.headercontentguard": { label: "Header content guard", path: "/contentguards/core/header/", nameField: "name" },
  "core.contentredirectcontentguard": {
    label: "Content redirect guard",
    path: "/contentguards/core/content_redirect/",
    nameField: "name",
  },
  "core.pulpexporter": { label: "Pulp exporter", path: "/exporters/core/pulp/", nameField: "name" },
  "core.filesystemexporter": { label: "Filesystem exporter", path: "/exporters/core/filesystem/", nameField: "name" },
  "core.pulpimporter": { label: "Pulp importer", path: "/importers/core/pulp/", nameField: "name" },
} satisfies Record<string, RoleObjectTypeConfig>;

export type RoleObjectTypeKey = keyof typeof ROLE_OBJECT_TYPES;

export function isRoleObjectType(value: unknown): value is RoleObjectTypeKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ROLE_OBJECT_TYPES, value);
}

/** Object types (that we know how to list) referenced by a role's permissions, in first-seen order. */
export function roleObjectTypesForPermissions(permissions: string[]): RoleObjectTypeKey[] {
  const found = new Set<RoleObjectTypeKey>();
  for (const permission of permissions) {
    const dot = permission.indexOf(".");
    if (dot <= 0) continue;
    const app = permission.slice(0, dot);
    const codename = permission.slice(dot + 1);
    for (const key of Object.keys(ROLE_OBJECT_TYPES) as RoleObjectTypeKey[]) {
      const [keyApp, model] = key.split(".");
      if (keyApp === app && codename.endsWith(`_${model}`)) {
        found.add(key);
      }
    }
  }
  return [...found];
}

export type RoleObjectOption = {
  pulp_href: string;
  label: string;
};

export type RoleObjectListResponse = {
  count: number;
  results: RoleObjectOption[];
};
