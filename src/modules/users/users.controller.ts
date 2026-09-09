import type { Request, Response } from 'express';
import { UsersService } from './users.service.js';

export async function getUserProfile(req: Request, res: Response) {
    const id = Number(req.params.id);
    const user = await UsersService.getById(id);

    if (!user) {
        return res.status(404).json({ status: 'ERROR', errors: ['Utilisateur introuvable.'] });
    }

    return res.json({ status: 'OK', user });
}

export async function updateMyProfile(req: Request, res: Response) {
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ status: 'ERROR', errors: ['Non authentifié.'] });
    }

    try {
        const updated = await UsersService.updateProfile(userId, req.body);
        return res.json({ status: 'OK', user: updated });
    } catch {
        return res.status(400).json({ status: 'ERROR', errors: ['Mise à jour impossible.'] });
    }
}