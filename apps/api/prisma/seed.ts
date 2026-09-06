import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
    const users = [
        { id: "1", name: "Fikri", email: "fikri@example.com" },
        { id: "2", name: "Ayu", email: "ayu@example.com" },
        { id: "3", name: "Budi", email: "budi@example.com" },
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { id: u.id },
            create: { ...u, orgId: "org_1" },
            update: {},
        });
    }

    for (const name of ["general", "engineering", "random"]) {
        const existing = await prisma.channel.findFirst({
            where: { orgId: "org_1", name },
        });
        if (existing) continue;

        await prisma.channel.create({
            data: {
                orgId: "org_1",
                name,
                type: "STANDARD",
                members: { create: users.map((u) => ({ userId: u.id })) },
            },
        });
    }

    console.log("Seeded 3 users and 3 channels");
}

main().finally(() => prisma.$disconnect());