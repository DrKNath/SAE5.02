import request from 'supertest';
import { expect, test } from 'vitest';
import { app } from '../../src/app.js';

test('Vérifie que la route API est fonctionnelle', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
});