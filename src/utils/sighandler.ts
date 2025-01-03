let handlers: (() => maybePromiseVoid)[] = [];
type maybePromiseVoid = void | Promise<void>

export const addSigListener = (fun: () => maybePromiseVoid) => {
  handlers.push(fun)
}
export const removeSigListener = (fun: () => maybePromiseVoid) => {
  handlers = handlers.filter(v => v === fun)
}

const sigHandler = async () => {
  console.log("Shutting down...")
  for (const i of handlers) {
    await i()
  }
  Deno.exit() 
}
if (Deno.build.os !== "windows") {
  Deno.addSignalListener("SIGTERM", sigHandler);
}
Deno.addSignalListener("SIGINT", sigHandler);
