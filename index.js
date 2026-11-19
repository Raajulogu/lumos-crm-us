import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";

// Routes
import { dbConnection } from "./db.js";

// Error handling & utilities
import { AppError } from "./errors/index.js";
import { requestId, errorHandler } from "./middleware/index.js";
import { logger } from "./utils/logger.js";

// ENV Configuration
dotenv.config();
const PORT = process.env.PORT;

const allowedOrigins = [
  "http://localhost:3000",
];

// Middleware
const app = express();
app.use(requestId);
app.use(express.json());
app.use(cors({ origin: allowedOrigins }));
// Removed global 40s timeout to prevent 504 errors on large uploads

const server = http.createServer(app);

// DB Connection
dbConnection();

// Routes
app.get("/", (req, res) => {
  res.send("Backend Service is running!");
});

// app.use("/auth", authRouter);

// 404 Catch-All Handler (For undefined routes)
app.use((req, res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// Central Error Handling Middleware (Catches all forwarded and unhandled errors)
app.use(errorHandler);

// Server Start
server.listen(PORT, () => {
  logger.info(`Dotzza Unified Backend is running`);
  logger.info(`HTTP + WebSocket server listening on port ${PORT}`);
});

// Process-level handlers for crash prevention (ARCH-01)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🔥 Process Unhandled Rejection:', { reason: reason?.stack || reason });
});
process.on('uncaughtException', (error) => {
  logger.error('🔥 Process Uncaught Exception:', { error: error?.stack || error });
});