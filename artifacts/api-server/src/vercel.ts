import express from "express";
import app from "./app";

// Explicitly use express to satisfy Vercel's static analysis
const vercelApp = express();
vercelApp.use(app);

export default vercelApp;
