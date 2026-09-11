import { prisma } from '../../config/db.js';
import type { Report, Post, User } from '@prisma/client';
import type { ReportResponse, ReportStatus, Role, UserSummary } from './moderation.types.js';

export class ModerationError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

function toReportStatus(status: string): ReportStatus {
    return status === 'RESOLVED' ? 'resolved' : 'pending';
}

export function toReportResponse(report: Report): ReportResponse {
    return {
        id: report.id,
        postId: report.postId as number,
        reason: report.reason,
        status: toReportStatus(report.status),
        reportedBy: report.userId,
    };
}

export function toUserSummary(user: User): UserSummary {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role as Role,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
    };
}

export async function createReport(reporterId: number, postId: number, reason: string): Promise<Report> {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
        throw new ModerationError('Post introuvable.', 404);
    }

    return prisma.report.create({
        data: {
            userId: reporterId,
            postId,
            reason,
            status: 'PENDING',
        },
    });
}

export async function listReports(status?: ReportStatus): Promise<Report[]> {
    return prisma.report.findMany({
        where: status ? { status: status.toUpperCase() } : undefined,
        orderBy: { createdAt: 'desc' },
    });
}

export async function resolveReport(reportId: number): Promise<Report> {
    const report = await prisma.report.findUnique({ where: { id: reportId } });

    if (!report) {
        throw new ModerationError('Signalement introuvable.', 404);
    }

    return prisma.report.update({
        where: { id: reportId },
        data: { status: 'RESOLVED' },
    });
}

export async function hidePost(postId: number): Promise<Post> {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
        throw new ModerationError('Post introuvable.', 404);
    }

    return prisma.post.update({
        where: { id: postId },
        data: { isHidden: true },
    });
}

export async function unhidePost(postId: number): Promise<Post> {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
        throw new ModerationError('Post introuvable.', 404);
    }

    return prisma.post.update({
        where: { id: postId },
        data: { isHidden: false },
    });
}

export async function deletePost(postId: number): Promise<void> {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
        throw new ModerationError('Post introuvable.', 404);
    }

    await prisma.post.delete({ where: { id: postId } });
}

async function findUserOrThrow(userId: number): Promise<User> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
        throw new ModerationError('Utilisateur introuvable.', 404);
    }

    return user;
}

export async function listUsers(): Promise<User[]> {
    return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function banUser(targetId: number, requesterId: number): Promise<User> {
    if (targetId === requesterId) {
        throw new ModerationError('Impossible de vous bannir vous-même.', 400);
    }

    await findUserOrThrow(targetId);

    return prisma.user.update({
        where: { id: targetId },
        data: { isBanned: true },
    });
}

export async function unbanUser(targetId: number): Promise<User> {
    await findUserOrThrow(targetId);

    return prisma.user.update({
        where: { id: targetId },
        data: { isBanned: false },
    });
}

export async function promoteToAdmin(targetId: number): Promise<User> {
    const user = await findUserOrThrow(targetId);

    if (user.role === 'SUPER_ADMIN') {
        throw new ModerationError("Impossible de modifier le rôle d'un super administrateur.", 400);
    }

    return prisma.user.update({
        where: { id: targetId },
        data: { role: 'ADMIN' },
    });
}

export async function demoteToUser(targetId: number): Promise<User> {
    const user = await findUserOrThrow(targetId);

    if (user.role === 'SUPER_ADMIN') {
        throw new ModerationError("Impossible de modifier le rôle d'un super administrateur.", 400);
    }

    return prisma.user.update({
        where: { id: targetId },
        data: { role: 'USER' },
    });
}
