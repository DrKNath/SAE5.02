import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Users API Integration', () => {
    it("devrait refuser l'accès à /api/users/me si l'utilisateur n'est pas authentifié", async () => {
        const response = await request(app).patch('/api/users/me').send({
            bio: 'Nouvelle bio de test',
        });

        expect(response.status).toBe(401);
        expect(response.body.status).toBe('ERROR');
    });
});