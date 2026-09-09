/**
 * Contrôleurs HTTP du module amis (E2).
 *
 * Chaque handler se limite à trois choses : extraire et valider les entrées,
 * appeler le service, formater la réponse. Aucune règle métier ici.
 */

import type { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../shared/errors/app-error.js';
import { currentUser } from '../../middlewares/require-auth.js';
import type { FriendsService } from './friends.service.js';

/**
 * Lit un paramètre d'URL et le convertit en entier positif.
 *
 * Sans cette validation, `/api/friends/abc` atteindrait Prisma avec un `NaN`,
 * qui produit une erreur 500 au lieu d'un 400 explicite.
 *
 * @param raw Valeur brute issue de l'URL.
 * @param name Nom du paramètre, pour le message d'erreur.
 * @return L'entier validé.
 * @throws {BadRequestError} Si la valeur n'est pas un entier positif.
 */
function parseId(raw: string | string[] | undefined, name: string): number {
    // Express 5 peut livrer un tableau si le paramètre apparaît plusieurs fois
    // dans l'URL : on refuse ce cas plutôt que de choisir arbitrairement.
    if (typeof raw !== 'string') {
        throw new BadRequestError('INVALID_ID', `Paramètre « ${name} » invalide.`);
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new BadRequestError('INVALID_ID', `Paramètre « ${name} » invalide.`);
    }
    return value;
}

/**
 * Enveloppe un handler asynchrone pour router ses rejets vers `next`.
 *
 * Express 5 propage déjà les promesses rejetées, mais l'enveloppe garde le
 * comportement explicite et documente l'intention.
 *
 * @param handler Handler à envelopper.
 * @return Un handler Express sûr.
 */
function wrap(
    handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
        handler(req, res).catch(next);
    };
}

/**
 * Construit les handlers du module à partir d'un service.
 *
 * L'injection permet de substituer un service de test dans les tests HTTP,
 * sans base de données.
 *
 * @param service Service des amitiés.
 * @return Les handlers, prêts à être montés sur un routeur.
 */
export function createFriendsController(service: FriendsService) {
    return {
        /** `GET /api/friends` — liste des amis confirmés. */
        listFriends: wrap(async (req, res) => {
            const me = currentUser(req);
            res.json({ friends: await service.listFriends(me.id) });
        }),

        /** `GET /api/friends/requests` — demandes reçues et envoyées. */
        listRequests: wrap(async (req, res) => {
            const me = currentUser(req);
            const [incoming, outgoing] = await Promise.all([
                service.listIncomingRequests(me.id),
                service.listOutgoingRequests(me.id),
            ]);
            res.json({ incoming, outgoing });
        }),

        /** `GET /api/friends/blocked` — comptes bloqués. */
        listBlocked: wrap(async (req, res) => {
            const me = currentUser(req);
            res.json({ blocked: await service.listBlocked(me.id) });
        }),

        /** `GET /api/friends/status/:userId` — relation avec un compte. */
        getStatus: wrap(async (req, res) => {
            const me = currentUser(req);
            const otherId = parseId(req.params['userId'], 'userId');
            res.json(await service.getRelationStatus(me.id, otherId));
        }),

        /** `POST /api/friends/requests/:userId` — envoyer une demande. */
        sendRequest: wrap(async (req, res) => {
            const me = currentUser(req);
            const targetId = parseId(req.params['userId'], 'userId');
            const relation = await service.sendRequest(me.id, targetId);
            res.status(201).json({ friendshipId: relation.id, status: relation.status });
        }),

        /** `POST /api/friends/requests/:id/accept` — accepter une demande. */
        acceptRequest: wrap(async (req, res) => {
            const me = currentUser(req);
            const friendshipId = parseId(req.params['id'], 'id');
            const relation = await service.acceptRequest(me.id, friendshipId);
            res.json({ friendshipId: relation.id, status: relation.status });
        }),

        /** `DELETE /api/friends/requests/:id` — refuser ou annuler. */
        dropRequest: wrap(async (req, res) => {
            const me = currentUser(req);
            const friendshipId = parseId(req.params['id'], 'id');

            // Refuser et annuler ciblent la même ressource ; le service
            // distingue les deux cas selon la position de l'appelant.
            try {
                await service.rejectRequest(me.id, friendshipId);
            } catch {
                await service.cancelRequest(me.id, friendshipId);
            }
            res.status(204).end();
        }),

        /** `DELETE /api/friends/:userId` — rompre une amitié. */
        removeFriend: wrap(async (req, res) => {
            const me = currentUser(req);
            const targetId = parseId(req.params['userId'], 'userId');
            await service.removeFriend(me.id, targetId);
            res.status(204).end();
        }),

        /** `POST /api/friends/block/:userId` — bloquer un compte. */
        blockUser: wrap(async (req, res) => {
            const me = currentUser(req);
            const targetId = parseId(req.params['userId'], 'userId');
            const relation = await service.blockUser(me.id, targetId);
            res.status(201).json({ friendshipId: relation.id, status: relation.status });
        }),

        /** `DELETE /api/friends/block/:userId` — lever un blocage. */
        unblockUser: wrap(async (req, res) => {
            const me = currentUser(req);
            const targetId = parseId(req.params['userId'], 'userId');
            await service.unblockUser(me.id, targetId);
            res.status(204).end();
        }),
    };
}
