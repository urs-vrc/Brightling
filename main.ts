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
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const body = await request.text();

  if (!signature || !timestamp) {
    return { valid: false, body };
  }

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

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

// --- Main Handler ---
async function recieveCmd(req: Request) {
  const requestStartedAt = Date.now();

  if (req.method === "GET") {
    return jsonResponse({ message: "Hello! This is a Discord interactions endpoint." }, { status: 200 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  if (!req.headers.get("X-Signature-Ed25519") || !req.headers.get("X-Signature-Timestamp")) {
    return jsonResponse({ error: "Missing required signature headers" }, { status: 400 });
  }

  const { valid, body } = await verifySignature(req);
  if (!valid) return jsonResponse({ error: "Invalid signature" }, { status: 400 });

  const interaction = JSON.parse(body);
  const { token, type, data } = interaction;

  switch (type) {
    case InteractionType.Ping:
      return jsonResponse({ type: InteractionResponseType.Pong });

    case InteractionType.ApplicationCommand:
      {
        const commandModules = await getCommandModules();
        const matchingCommand = commandModules.find((command) => command.definition.name === data.name);

        if (!matchingCommand) {
          return jsonResponse({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content: `Unknown command: ${data.name}` },
          });
        }

        const commandResponse = await matchingCommand.handleCommand({
          interaction,
          requestStartedAt,
        });

        return jsonResponse(commandResponse);
      }

    case InteractionType.ModalSubmit: {
      const modalResponse = await routeModalSubmit({
        applicationId: DISCORD_APPLICATION_ID,
        token,
        data,
      });

      if (!modalResponse) {
        return jsonResponse({ error: "Unhandled modal submit" }, { status: 400 });
      }

      return jsonResponse(modalResponse);
    }

    default:
      return jsonResponse({ error: "Unhandled interaction type" }, { status: 400 });
  }
}

Deno.serve(recieveCmd);