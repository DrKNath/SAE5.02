import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('GET /health', () => {
    it('devrait retourner un statut 200 et le message de confirmation', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'OK',
            message: 'API Vistagram fonctionnelle',
        });
    });
});