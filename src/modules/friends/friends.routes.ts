/**
 * Routeur du module amis (E2).
 *
 * Toutes les routes exigent une authentification : aucune information de
 * relation n'est publique.
 */

import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { createFriendsController } from './friends.controller.js';
import { PrismaFriendsRepository } from './friends.repository.js';
import { FriendsService } from './friends.service.js';

/**
 * Construit le routeur du module.
 *
 * Le service est injectable pour permettre aux tests HTTP d'utiliser un dépôt
 * en mémoire plutôt que Prisma.
 *
 * @param service Service à utiliser. Par défaut, celui adossé à Prisma.
 * @return Le routeur à monter sur `/api/friends`.
 */
export function createFriendsRouter(
    service: FriendsService = new FriendsService(new PrismaFriendsRepository()),
): Router {
    const router = Router();
    const controller = createFriendsController(service);

    router.use(requireAuth);

    // Les chemins littéraux précèdent les chemins paramétrés, sinon
    // `/requests` serait capté par `/:userId`.
    router.get('/', controller.listFriends);
    router.get('/requests', controller.listRequests);
    router.get('/blocked', controller.listBlocked);
    router.get('/status/:userId', controller.getStatus);

    router.post('/requests/:userId', controller.sendRequest);
    router.post('/requests/:id/accept', controller.acceptRequest);
    router.delete('/requests/:id', controller.dropRequest);

    router.post('/block/:userId', controller.blockUser);
    router.delete('/block/:userId', controller.unblockUser);

    router.delete('/:userId', controller.removeFriend);

    return router;
}
