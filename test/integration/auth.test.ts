import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/config/db';

const testUser = {
    email: 'test.auth@vistagram.local',
    username: 'test_auth_user',
    password: 'motdepasse123',
};

async function cleanup() {
    await prisma.user.deleteMany({ where: { email: testUser.email } });
}

beforeAll(cleanup);

afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
    it('refuse une inscription avec des données invalides', async () => {
        const response = await request(app).post('/api/auth/register').send({
            email: 'pas-un-email',
            username: 'ab',
            password: '123',
        });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('ERROR');
    });

    it('inscrit un nouvel utilisateur et pose un cookie de session', async () => {
        const response = await request(app).post('/api/auth/register').send(testUser);

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('OK');
        expect(response.body.user.email).toBe(testUser.email);
        expect(response.body.user.password).toBeUndefined();
        expect(response.headers['set-cookie']).toBeDefined();
    });

    it('refuse une seconde inscription avec le même email', async () => {
        const response = await request(app).post('/api/auth/register').send(testUser);
        expect(response.status).toBe(409);
    });
});

describe('POST /api/auth/login', () => {
    it('refuse une connexion avec un mauvais mot de passe', async () => {
        const response = await request(app).post('/api/auth/login').send({
            email: testUser.email,
            password: 'mauvais-mot-de-passe',
        });
        expect(response.status).toBe(401);
    });

    it('refuse une connexion avec un email inconnu', async () => {
        const response = await request(app).post('/api/auth/login').send({
            email: 'inconnu@vistagram.local',
            password: 'peu-importe',
        });
        expect(response.status).toBe(401);
    });

    it('connecte un utilisateur existant', async () => {
        const response = await request(app).post('/api/auth/login').send({
            email: testUser.email,
            password: testUser.password,
        });

        expect(response.status).toBe(200);
        expect(response.body.user.username).toBe(testUser.username);
    });
});

describe('GET /api/auth/me', () => {
    it('refuse sans être authentifié', async () => {
        const response = await request(app).get('/api/auth/me');
        expect(response.status).toBe(401);
    });

    it('autorise avec le cookie de session', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({
            email: testUser.email,
            password: testUser.password,
        });

        const response = await agent.get('/api/auth/me');
        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe(testUser.email);
    });
});

describe('POST /api/auth/logout', () => {
    it('déconnecte un utilisateur et invalide sa session', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({
            email: testUser.email,
            password: testUser.password,
        });

        const logoutResponse = await agent.post('/api/auth/logout');
        expect(logoutResponse.status).toBe(200);

        const meResponse = await agent.get('/api/auth/me');
        expect(meResponse.status).toBe(401);
    });
});
