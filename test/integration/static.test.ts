import request from 'supertest';
import { expect, test } from 'vitest';
import { app } from '../../src/app.js';

test('Gère correctement le dossier des fichiers statiques', async () => {
    const response = await request(app).get('/uploads/fichier-fantome.png');

    expect(response.status).toBe(404);
});