module.exports = async function handler(req, res) {
  //#region debug-point entry-init
  const debugState = {
    phase: "bootstrap",
    importPath: "../artifacts/api-server/dist/app.mjs",
  };
  //#endregion

  try {
    //#region debug-point entry-import-start
    debugState.phase = "import:start";
    //#endregion
    const module = await import("../artifacts/api-server/dist/app.mjs");
    //#region debug-point entry-import-success
    debugState.phase = "import:success";
    debugState.exportType = typeof module.default;
    //#endregion
    return module.default(req, res);
  } catch (err) {
    //#region debug-point entry-import-failure
    debugState.phase = "import:failure";
    debugState.errorName = err?.name;
    debugState.errorMessage = err?.message;
    debugState.errorCode = err?.code;
    //#endregion
    res.status(500).json({
      error: "Initialization Error",
      debugState,
    });
  }
};
