import request from 'supertest';
import { expect, test } from 'vitest';
import { app } from '../../src/app.js';

test('Retourne une erreur 404 pour une route inexistante', async () => {
    const response = await request(app).get('/route-qui-n-existe-pas');

    expect(response.status).toBe(404);
});