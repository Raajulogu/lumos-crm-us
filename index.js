import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";

// Database
import { dbConnection } from "./db.js";

// Routes
import apiRoutes from "./routes/index.js";

// Error handling & utilities
import { AppError } from "./errors/index.js";
import { requestId, errorHandler } from "./middleware/index.js";
import { logger } from "./utils/logger.js";

// ENV Configuration
dotenv.config();
const PORT = process.env.PORT || 5000;

// Middleware
const app = express();
app.use(requestId);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));

const server = http.createServer(app);

// Root Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Lumos CRM Backend Service is running!",
    timestamp: new Date().toISOString(),
  });
});

// Mount All V1 API Routes
app.use("/api/v1", apiRoutes);

// 404 Catch-All Handler (For undefined routes)
app.use((req, res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// Central Error Handling Middleware (Catches all forwarded and unhandled errors)
app.use(errorHandler);

// Start Server & Connect Database
async function startServer() {
  try {
    if (process.env.MONGO_URL || process.env.MONGO_URI) {
      await dbConnection();
    } else {
      logger.warn("⚠️ MONGO_URL not provided. Running server without database connection.");
    }

    server.listen(PORT, () => {
      logger.info(`🚀 Lumos CRM Backend is running`);
      logger.info(`📡 HTTP API listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    // Still listen so healthcheck / routes can reply with informative DB error if desired
    server.listen(PORT, () => {
      logger.warn(`Server running in degraded state on port ${PORT}`);
    });
  }
}

startServer();

// Process-level handlers for crash prevention
process.on("unhandledRejection", (reason) => {
  logger.error("🔥 Process Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("🔥 Process Uncaught Exception:", error);
});
