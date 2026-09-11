import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../modules/auth/auth.js';
import { prisma } from '../config/db.js';

declare global {
    namespace Express {
        interface Request {
            userId?: number;
        }
    }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ status: 'ERROR', errors: ['Non authentifié.'] });
    }

    try {
        const payload = verifyToken(token);

        // Vérifie que le compte existe toujours et n'a pas été banni depuis
        // la création du cookie de session (un JWT reste valide plusieurs jours).
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });

        if (!user) {
            return res.status(401).json({ status: 'ERROR', errors: ['Non authentifié.'] });
        }

        if (user.isBanned) {
            return res.status(403).json({ status: 'ERROR', errors: ['Ce compte a été banni.'] });
        }

        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ status: 'ERROR', errors: ['Session invalide ou expirée.'] });
    }
}
