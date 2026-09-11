import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import {
    reportContent,
    getReports,
    resolveReportHandler,
    hidePostHandler,
    unhidePostHandler,
    deletePostHandler,
    getUsers,
    banUserHandler,
    unbanUserHandler,
    promoteUserHandler,
    demoteUserHandler,
} from './moderation.controller.js';

export const moderationRouter = Router();

// N'importe quel utilisateur connecté peut signaler un contenu
moderationRouter.post('/reports', requireAuth, reportContent);

// Seuls les administrateurs (ADMIN ou SUPER_ADMIN) gèrent les signalements et le contenu
moderationRouter.get('/reports', requireAuth, requireRole('ADMIN'), getReports);
moderationRouter.patch('/reports/:id/resolve', requireAuth, requireRole('ADMIN'), resolveReportHandler);
moderationRouter.patch('/posts/:id/hide', requireAuth, requireRole('ADMIN'), hidePostHandler);
moderationRouter.patch('/posts/:id/unhide', requireAuth, requireRole('ADMIN'), unhidePostHandler);
moderationRouter.delete('/posts/:id', requireAuth, requireRole('ADMIN'), deletePostHandler);

// Gestion des utilisateurs (bannir / débannir / droits admin) : réservée au super administrateur
moderationRouter.get('/users', requireAuth, requireRole('SUPER_ADMIN'), getUsers);
moderationRouter.patch('/users/:id/ban', requireAuth, requireRole('SUPER_ADMIN'), banUserHandler);
moderationRouter.patch('/users/:id/unban', requireAuth, requireRole('SUPER_ADMIN'), unbanUserHandler);
moderationRouter.patch('/users/:id/promote', requireAuth, requireRole('SUPER_ADMIN'), promoteUserHandler);
moderationRouter.patch('/users/:id/demote', requireAuth, requireRole('SUPER_ADMIN'), demoteUserHandler);
