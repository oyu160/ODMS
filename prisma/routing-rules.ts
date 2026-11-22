// Meta ugugdluur awtomataar chigluuleh jishee durmuud (seed bolon tusdaa ajilluulj bolno)
// Tusad ni: npm run db:routing   — odoo baigaa ugugdliig ustgahgui, ijil nertei durmiig shinechilne
import { PrismaClient } from "@prisma/client";

type Rule = {
  name: string;
  priority: number;
  reviewer: string; // username
  type?: string; // document type code
  confidentiality?: string;
  direction?: string;
  field?: [string, string]; // [field name, value]
};

const RULES: Rule[] = [
  { name: "Нууц баримтыг Гүйцэтгэх захирал хянана", priority: 10, reviewer: "director", confidentiality: "CONFIDENTIAL" },
  { name: "Ажилтны тушаал (Б) Хүний нөөцийн албаны даргад", priority: 20, reviewer: "sukhbat", type: "ORDER_B" },
  { name: "Гэрээг Санхүүгийн хэлтсийн даргад", priority: 30, reviewer: "oyun", type: "CONTRACT" },
  { name: "Шийдвэрийг Гүйцэтгэх захиралд", priority: 40, reviewer: "director", type: "DECISION" },
  { name: "Явсан бичгийг Захиргааны хэлтсийн даргад", priority: 90, reviewer: "manager", direction: "OUTGOING" },
];

export async function seedRoutingRules(prisma: PrismaClient) {
  let n = 0;
  for (const r of RULES) {
    const reviewer = await prisma.user.findUnique({ where: { username: r.reviewer } });
    if (!reviewer) continue;
    const type = r.type ? await prisma.documentType.findUnique({ where: { code: r.type } }) : null;
    const field = r.field && type ? await prisma.fieldDefinition.findFirst({ where: { documentTypeId: type.id, name: r.field[0] } }) : null;
    const data = {
      name: r.name,
      priority: r.priority,
      reviewerId: reviewer.id,
      documentTypeId: type?.id ?? null,
      confidentiality: r.confidentiality ?? null,
      direction: r.direction ?? null,
      fieldId: field?.id ?? null,
      fieldValue: r.field?.[1] ?? null,
      isActive: true,
    };
    const existing = await prisma.routingRule.findFirst({ where: { name: r.name } });
    if (existing) await prisma.routingRule.update({ where: { id: existing.id }, data });
    else await prisma.routingRule.create({ data });
    n++;
  }
  console.log(`Чиглүүлэх дүрэм: ${n}`);
}

if (process.argv[1]?.endsWith("routing-rules.ts")) {
  const prisma = new PrismaClient();
  seedRoutingRules(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
