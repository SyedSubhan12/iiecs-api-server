let app;
try {
  const module = await import("../artifacts/api-server/dist/app.mjs");
  app = module.default;
} catch (err) {
  console.error("Critical error during API initialization:", err);
  app = (req, res) => {
    res.status(500).json({
      error: "Initialization Error",
      message: err.message,
    });
  };
}
export default app;
