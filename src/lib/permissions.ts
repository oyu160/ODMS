// Эрхийн шалгалт — серверийн хамааралгүй цэвэр функц (тестлэхэд хялбар)
export type PermissionHolder = { permissions: Set<string> };

export function can(user: PermissionHolder, permission: string) {
  return user.permissions.has(permission);
}
