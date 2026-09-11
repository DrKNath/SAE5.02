import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/db.js';

/**
 * Crée le compte super administrateur par défaut s'il n'existe pas déjà.
 * Ce compte NE PASSE JAMAIS par la page d'inscription du site — c'est le
 * seul moyen d'obtenir le rôle SUPER_ADMIN.
 *
 * Lancer avec : npm run db:seed
 * Configurable via .env : SUPER_ADMIN_EMAIL, SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD
 */
async function main() {
    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@vistagram.local';
    const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
        console.log(`Le compte super admin existe déjà (${email}), rien à faire.`);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
        data: {
            email,
            username,
            password: hashedPassword,
            role: 'SUPER_ADMIN',
        },
    });

    console.log(`Compte super admin créé : ${email} / ${username}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
