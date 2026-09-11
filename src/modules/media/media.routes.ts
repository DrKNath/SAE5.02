import { Router } from 'express';
import multer from 'multer';
import { uploadMedia } from './media.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

// Stockage temporaire en mémoire pour le traitement direct via Sharp
const upload = multer({ storage: multer.memoryStorage() });

export const mediaRouter = Router();

// On attend un champ "file" dans le form-data
mediaRouter.post('/uploads', requireAuth, upload.single('file'), uploadMedia);