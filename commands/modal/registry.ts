import { replModalHandler } from "../repl/modal.ts";
import type { ModalHandler, ModalHandlerResponse, ModalSubmitContext } from "./types.ts";

const modalHandlers: ModalHandler[] = [
  replModalHandler,
];

export async function routeModalSubmit(
  context: ModalSubmitContext,
): Promise<ModalHandlerResponse | null> {
  const customId = typeof context.data.custom_id === "string" ? context.data.custom_id : "";

  for (const handler of modalHandlers) {
    if (handler.canHandle(customId)) {
      return await handler.handle(context);
    }
  }

  return null;
}
