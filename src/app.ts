import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Route de test
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'API Vistagram fonctionnelle' });
});

// app.use('/api/auth', authRouter);
// app.use('/api/users', usersRouter);