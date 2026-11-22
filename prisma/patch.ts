// Odoo baigaa ugugdliig ustgahguigeer shine shiljilt, erhiig nemne (dahin ajilluulahad ayuulgui)
// Ajilluulah: npm run db:patch
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TRANSITIONS: [string, string, string, string, string][] = [
  ["IN_REVIEW", "IN_REVIEW", "forward", "document.approve", "Дараагийн хянагч руу шилжүүлэх"],
  ["IN_REVIEW", "CANCELLED", "cancel", "document.cancel", "Хянагч цуцлах"],
  ["REGISTERED", "ARCHIVED", "archive", "document.archive", "Хуваарилалгүй архивлах"],
];

async function main() {
  // Batlagdsan → Zaswart (revoke) shiljiltiig hasna (Zurag 2.3-t baihgui)
  const removed = await prisma.statusTransition.deleteMany({ where: { actionCode: "revoke" } });
  if (removed.count) console.log(`- Батлалтыг цуцлах шилжилт хасагдлаа (${removed.count})`);

  for (const [from, to, action, permCode, label] of TRANSITIONS) {
    const [f, t, perm] = await Promise.all([
      prisma.documentStatus.findUniqueOrThrow({ where: { code: from } }),
      prisma.documentStatus.findUniqueOrThrow({ where: { code: to } }),
      prisma.permission.findUniqueOrThrow({ where: { code: permCode } }),
    ]);
    const exists = await prisma.statusTransition.findFirst({ where: { fromStatusId: f.id, actionCode: action, documentTypeId: null } });
    if (exists) {
      console.log(`✓ ${label} — аль хэдийн байна`);
      continue;
    }
    await prisma.statusTransition.create({ data: { fromStatusId: f.id, toStatusId: t.id, actionCode: action, permissionId: perm.id } });
    console.log(`+ ${label} (${from} → ${to}) нэмэгдлээ`);
  }

  // Udirdlaga barimt tsutslah erhtei (Husnegt 2.4)
  const [role, perm] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { code: "MANAGER" } }),
    prisma.permission.findUniqueOrThrow({ where: { code: "document.cancel" } }),
  ]);
  const has = await prisma.rolePermission.findFirst({ where: { roleId: role.id, permissionId: perm.id } });
  if (!has) {
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    console.log("+ Удирдлага: document.cancel эрх нэмэгдлээ");
  }

  // Dugaarlaltiin helbert on nemeh (jil bur teglegddeg durem)
  const rules = await prisma.numberingRule.findMany({ where: { resetPeriod: "YEARLY" } });
  for (const r of rules) {
    if (/\{YYYY\}|\{YY\}/.test(r.pattern)) continue;
    const pattern = r.pattern.replace(/\{SEQ/, "{YY}-{SEQ");
    await prisma.numberingRule.update({ where: { id: r.id }, data: { pattern } });
    console.log(`~ Дугаарлалт: ${r.pattern} → ${pattern}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
