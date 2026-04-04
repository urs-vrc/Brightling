import { json, validateRequest } from "sift";
import nacl from "tweetnacl";
import { InteractionResponseType, InteractionType } from "discord-api-types/v10";
import { discoverCommandModules } from "./commands/registry.ts";
import { routeModalSubmit } from "./commands/modal/registry.ts";
import type { CommandModule } from "./commands/types.ts";

const DISCORD_APPLICATION_ID = Deno.env.get("DISCORD_APP_ID")!;
const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY")!;
let commandModulesPromise: Promise<CommandModule[]> | null = null;

function getCommandModules() {
  if (!commandModulesPromise) {
    commandModulesPromise = discoverCommandModules();
  }
  return commandModulesPromise;
}

async function verifySignature(
  request: Request,
): Promise<{ valid: boolean; body: string, timestamp?: string }> {
  const signature = request.headers.get("X-Signature-Ed25519")!;
  const timestamp = request.headers.get("X-Signature-Timestamp")!;
  const body = await request.text();
  const valid = nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + body),
    hexToUint8Array(signature),
    hexToUint8Array(DISCORD_PUBLIC_KEY),
  );
  return { valid, body, timestamp };
}

function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((val) => parseInt(val, 16)));
}

// --- Main Handler ---
async function recieveCmd(req: Request) {
  const requestStartedAt = Date.now();

  if (req.method === "GET") {
    return json({ message: "Hello! This is a Discord interactions endpoint." }, { status: 200 });
  }

  const { error } = await validateRequest(req, {
    POST: { headers: ["X-Signature-Ed25519", "X-Signature-Timestamp"] },
  });
  if (error) return json({ error: error.message }, { status: error.status });

  const { valid, body } = await verifySignature(req);
  if (!valid) return json({ error: "Invalid signature" }, { status: 400 });

  const interaction = JSON.parse(body);
  const { token, type, data } = interaction;

  switch (type) {
    case InteractionType.Ping:
      return json({ type: InteractionResponseType.Pong });

    case InteractionType.ApplicationCommand:
      {
        const commandModules = await getCommandModules();
        const matchingCommand = commandModules.find((command) => command.definition.name === data.name);

        if (!matchingCommand) {
          return json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content: `Unknown command: ${data.name}` },
          });
        }

        const commandResponse = await matchingCommand.handleCommand({
          interaction,
          requestStartedAt,
        });

        return json(commandResponse);
      }

    case InteractionType.ModalSubmit: {
      const modalResponse = await routeModalSubmit({
        applicationId: DISCORD_APPLICATION_ID,
        token,
        data,
      });

      if (!modalResponse) {
        return json({ error: "Unhandled modal submit" }, { status: 400 });
      }

      return json(modalResponse);
    }

    default:
      return json({ error: "Unhandled interaction type" }, { status: 400 });
  }
}

Deno.serve(recieveCmd);