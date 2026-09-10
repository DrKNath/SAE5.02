import request from 'supertest';
import { expect, test } from 'vitest';
import { app } from '../../src/app.js';

test('Retourne 404 si on utilise POST sur une route GET', async () => {
    // La route /health est définie avec app.get(), un POST doit donc échouer
    const response = await request(app).post('/health');

    expect(response.status).toBe(404);
});