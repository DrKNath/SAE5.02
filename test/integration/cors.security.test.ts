import request from 'supertest';
import { expect, test } from 'vitest';
import { app } from '../../src/app.js';

test('Vérifie la présence des en-têtes de sécurité CORS', async () => {
    const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000'); // Ajout de l'origine

    expect(response.headers['access-control-allow-origin']).toBeDefined();
    expect(response.status).toBe(200);
});