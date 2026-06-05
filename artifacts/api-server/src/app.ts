import express from "express";
import cors from "cors";
import type { IncomingMessage, ServerResponse } from "http";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: any = express();

// pino-http uses `export =` which is not directly callable under all
// moduleResolution modes (e.g. Vercel uses "node"/"node16" instead of "bundler").
// Casting to `any` is intentional and safe here — it bypasses the TS2349 error
// without affecting runtime behaviour.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createHttpLogger = pinoHttp as any;

app.use(
  createHttpLogger({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: string | number }) {
        return {
          id: (req as { id?: string | number }).id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
