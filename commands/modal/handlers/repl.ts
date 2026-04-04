import type { ModalHandler } from "../types.ts";
import { handleReplModalSubmit, isReplModal } from "../../repl/modal.ts";

const handler: ModalHandler = {
  name: "repl",
  canHandle: isReplModal,
  handle: handleReplModalSubmit,
};

export default handler;
