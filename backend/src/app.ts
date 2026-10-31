import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { env } from './config.js';
import { errorHandler, notFound } from './middleware/error.js';
import { authRouter } from './routes/auth.route.js';
import { coursesRouter } from './routes/courses.route.js';
import { gradeScaleRouter } from './routes/gradeScale.route.js';
import { plansRouter } from './routes/plans.route.js';
import { semestersRouter } from './routes/semesters.route.js';

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/semesters', semestersRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/grade-scale', gradeScaleRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}