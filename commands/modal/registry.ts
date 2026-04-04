import type { ModalHandler, ModalHandlerResponse, ModalSubmitContext } from "./types.ts";

let modalHandlersPromise: Promise<ModalHandler[]> | null = null;

function isModalHandler(value: unknown): value is ModalHandler {
  if (!value || typeof value !== "object") return false;

  const maybeHandler = value as Partial<ModalHandler>;
  return Boolean(
    typeof maybeHandler.name === "string"
      && typeof maybeHandler.canHandle === "function"
      && typeof maybeHandler.handle === "function",
  );
}

async function discoverModalHandlers(): Promise<ModalHandler[]> {
  const handlersDirectory = new URL("./handlers/", import.meta.url);
  const handlers: ModalHandler[] = [];

  for await (const entry of Deno.readDir(handlersDirectory)) {
    if (!entry.isFile || !entry.name.endsWith(".ts")) {
      continue;
    }

    const moduleUrl = new URL(entry.name, handlersDirectory).href;
    const imported = await import(moduleUrl);

    if (!isModalHandler(imported.default)) {
      throw new Error(`Invalid modal handler module in ${entry.name}`);
    }

    handlers.push(imported.default);
  }

  handlers.sort((a, b) => a.name.localeCompare(b.name));
  return handlers;
}

function getModalHandlers() {
  if (!modalHandlersPromise) {
    modalHandlersPromise = discoverModalHandlers();
  }
  return modalHandlersPromise;
}

export async function routeModalSubmit(
  context: ModalSubmitContext,
): Promise<ModalHandlerResponse | null> {
  const customId = typeof context.data.custom_id === "string" ? context.data.custom_id : "";
  const handlers = await getModalHandlers();

  for (const handler of handlers) {
    if (handler.canHandle(customId)) {
      return await handler.handle(context);
    }
  }

  return null;
}
