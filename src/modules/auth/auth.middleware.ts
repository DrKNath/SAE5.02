import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './auth.js';

declare global {
    namespace Express {
        interface Request {
            userId?: number;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ status: 'ERROR', errors: ['Non authentifié.'] });
    }

    try {
        const payload = verifyToken(token);
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ status: 'ERROR', errors: ['Session invalide ou expirée.'] });
    }
}
