import request from 'supertest';
import { expect, test } from 'vitest';
import { app } from '../../src/app.js';

test('Retourne le bon format de réponse (application/json)', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['content-type']).toMatch(/json/);
});