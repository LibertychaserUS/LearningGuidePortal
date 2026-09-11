import Module from "node:module";

async function main() {
  const jar = new Map([["learning_guide_session", "tok-1"]]);
  const mock = {
    cookies: async () => ({
      get: (name: string) => {
        const value = jar.get(name);
        return value === undefined ? undefined : { name, value };
      },
    }),
    headers: async () => new Headers({ cookie: "learning_guide_session=tok-1" }),
    draftMode: async () => ({ isEnabled: false }),
  };

  const loaded: string[] = [];
  const orig = (Module as typeof Module & { _load: Function })._load;
  (Module as typeof Module & { _load: Function })._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === "next/headers" || request.endsWith("/headers") || request.includes("next/headers")) {
      loaded.push(`intercept:${request}`);
      return mock;
    }
    return orig.call(this, request, parent, isMain);
  };

  const dyn = await import("next/headers");
  console.log("viaImport cookies name", dyn.cookies?.name);
  try {
    const store = await dyn.cookies();
    console.log("viaImport.get", (store as { get?: (n: string) => unknown }).get?.("learning_guide_session"));
  } catch (e) {
    console.log("viaImport error", (e as Error).message.split("\n")[0]);
  }

  const auth = await import("./services/productAuth");
  console.log("currentProductUser arity", auth.currentProductUser.length);
  try {
    const user = await auth.currentProductUser();
    console.log("user without request", user);
  } catch (e) {
    console.log("currentProductUser error", (e as Error).message.split("\n")[0]);
  }
  console.log("intercepts", loaded);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
