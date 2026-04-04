import { InteractionResponseType } from "discord-api-types/v10";
import type { CommandModule } from "../types.ts";

function buildPingMessage(requestStartedAt: number): string {
  const elapsedMs = Math.max(0, Date.now() - requestStartedAt);
  return `Hello from the Arona System Gateway! Your RTT to the nearest gateway is ${elapsedMs}ms`;
}

const pingCommand: CommandModule = {
  scope: "global",
  definition: {
    name: "ping",
    description: "Check gateway RTT",
    type: 1,
  },
  handleCommand(context) {
    return Promise.resolve({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: buildPingMessage(context.requestStartedAt),
      },
    });
  },
};

export default pingCommand;
