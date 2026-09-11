import request from 'supertest';
import { expect, test } from 'vitest';
import { app } from '../../src/app.js';

test('Retourne une erreur 400 en cas de JSON malformé', async () => {
    const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{ "mauvais": "json" ');

    expect(response.status).toBe(400);
});