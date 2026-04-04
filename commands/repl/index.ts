import type { CommandModule } from "../types.ts";
import {
  REPL_MODAL_CODE_FIELD_ID,
  REPL_MODAL_PREFIX,
} from "./constants.ts";

const MODAL_RESPONSE_TYPE = 9;

const replCommand: CommandModule = {
  definition: {
    name: "repl",
    description: "Run Python code in a safe sandbox",
    type: 1,
  },
  handleCommand(context) {
    return Promise.resolve({
      type: MODAL_RESPONSE_TYPE,
      data: {
        custom_id: `${REPL_MODAL_PREFIX}${Date.now()}_${context.interaction.member?.user?.id || "anon"}`,
        title: "Python REPL - Enter your code",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: REPL_MODAL_CODE_FIELD_ID,
                label: "Your Python code",
                style: 2,
                placeholder: "import matplotlib.pyplot as plt\\nplt.plot([1, 2, 3])",
                required: true,
                min_length: 1,
                max_length: 4000,
              },
            ],
          },
        ],
      },
    });
  },
};

export default replCommand;
