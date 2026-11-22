// Erhiin shalgalt — serweriin hamaaralgui tsewer funkts (testlehed hyalbar)
export type PermissionHolder = { permissions: Set<string> };

export function can(user: PermissionHolder, permission: string) {
  return user.permissions.has(permission);
}
