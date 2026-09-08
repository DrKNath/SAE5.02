import {describe, it, expect} from 'vitest';
import {
  canDeletePost,
  canModerate,
  ModerationError,
  resolveReport,
} from '../src/domain/moderation.js';
import type {ReportState} from '../src/domain/moderation.js';

describe('canModerate', () => {
  it('autorise un administrateur', () => {
    expect(canModerate('admin')).toBe(true);
  });

  it('autorise un moderateur', () => {
    expect(canModerate('moderator')).toBe(true);
  });

  it('refuse un utilisateur standard', () => {
    expect(canModerate('user')).toBe(false);
  });
});

describe('canDeletePost', () => {
  it('un auteur peut supprimer sa publication', () => {
    expect(canDeletePost({id: 1, role: 'user'}, {authorId: 1})).toBe(true);
  });

  it('un utilisateur ne peut pas supprimer la publication d autrui', () => {
    expect(canDeletePost({id: 2, role: 'user'}, {authorId: 1})).toBe(false);
  });

  it('un moderateur peut supprimer la publication d autrui', () => {
    expect(canDeletePost({id: 2, role: 'moderator'}, {authorId: 1})).toBe(true);
  });
});

describe('resolveReport', () => {
  const open: ReportState = {status: 'open', handledBy: null};

  it('un moderateur peut retenir un signalement', () => {
    const next = resolveReport(open, {
      decision: 'upheld',
      moderator: {id: 9, role: 'moderator'},
    });
    expect(next).toEqual({status: 'upheld', handledBy: 9});
  });

  it('un moderateur peut rejeter un signalement', () => {
    const next = resolveReport(open, {
      decision: 'dismissed',
      moderator: {id: 9, role: 'admin'},
    });
    expect(next.status).toBe('dismissed');
  });

  it('refuse le traitement par un utilisateur standard', () => {
    expect(() =>
      resolveReport(open, {decision: 'upheld', moderator: {id: 3, role: 'user'}}),
    ).toThrow(ModerationError);
  });

  it('refuse de retraiter un signalement deja clos', () => {
    const closed: ReportState = {status: 'dismissed', handledBy: 9};
    expect(() =>
      resolveReport(closed, {
        decision: 'upheld',
        moderator: {id: 9, role: 'admin'},
      }),
    ).toThrow(ModerationError);
  });
});
