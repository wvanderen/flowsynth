const prototypeRequested = new URLSearchParams(location.search).get("prototype") === "retheme";
if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV && prototypeRequested) {
  void import("./ui/retheme-prototype").then(({ mountRethemePrototype }) => mountRethemePrototype());
} else {
  void import("./main-app");
}
