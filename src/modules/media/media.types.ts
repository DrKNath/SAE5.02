export type MediaResponse = {
    success: boolean;
    mediaUrl: string; // L'URL finale de l'image (ex: "/uploads/image-123.jpg")
    format: string;   // ex: "webp" ou "jpeg"
};

export type MediaProcessingOptions = {
    width?: number;
    height?: number;
    filter?: 'grayscale' | 'sepia' | string;
    blur?: number;
};