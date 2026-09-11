import type { Request, Response } from 'express';
import { MediaService } from './media.service.js';
import path from 'path';
import fs from 'fs/promises';

export async function uploadMedia(req: Request, res: Response) {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'ERROR', errors: ['Aucun fichier fourni.'] });
        }

        // Extraction des options depuis le form-data
        const options = {
            width: req.body.width ? parseInt(req.body.width) : undefined,
            height: req.body.height ? parseInt(req.body.height) : undefined,
            filter: req.body.filter,
            blur: req.body.blur ? parseFloat(req.body.blur) : undefined,
        };

        // Traitement de l'image
        const { buffer, format } = await MediaService.processImage(req.file.buffer, options);

        // Sauvegarde sur le disque
        const fileName = `media-${Date.now()}.${format}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');

        await fs.mkdir(uploadDir, { recursive: true });
        await fs.writeFile(path.join(uploadDir, fileName), buffer);

        return res.status(201).json({
            success: true,
            mediaUrl: `uploads/${fileName}`,
            format,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'ERROR', errors: ['Erreur lors du traitement du fichier.'] });
    }
}