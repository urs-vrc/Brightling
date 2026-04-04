import { RouteBases, Routes } from "discord-api-types/rest-v10";
import axios, { AxiosError } from "axios";
import { discoverCommandModules } from "./commands/registry.ts";
import type { CommandDefinition } from "./commands/types.ts";

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
const APP_ID = Deno.env.get("DISCORD_APP_ID") ?? "";
const GUILD_ID = Deno.env.get("DISCORD_TEST_GUILD_ID");

if (!DISCORD_TOKEN || !APP_ID) {
  console.error("Missing DISCORD_TOKEN or DISCORD_APP_ID in .env");
  Deno.exit(1);
}

const headers = {
  "Authorization": `Bot ${DISCORD_TOKEN}`,
  "Content-Type": "application/json",
};

async function deployCommandSet(
  label: string,
  url: string,
  commands: CommandDefinition[],
) {
  try {
    const response = await axios.put(url, commands, { headers });
    console.log(`Success! Registered ${commands.length} ${label} command(s).`);
    console.log(response.data);
  } catch (error: unknown) {
    const err = error as AxiosError;
    console.error(`Failed to register ${label} commands:`);
    console.error(err.response?.data || err.message);
    if (err.response?.status === 429) {
      console.error("Rate limited - wait and retry");
    }
    Deno.exit(1);
  }
}

async function deploy() {
  const commandModules = await discoverCommandModules();
  const globalCommands = commandModules
    .filter((module) => (module.scope ?? "global") === "global")
    .map((module) => module.definition);
  const guildCommands = commandModules
    .filter((module) => module.scope === "guild")
    .map((module) => module.definition);

  console.log("Deploying global commands (may take up to 1 hour to appear everywhere)");
  await deployCommandSet(
    "global",
    `${RouteBases.api}/${Routes.applicationCommands(APP_ID)}`,
    globalCommands,
  );

  if (!GUILD_ID && guildCommands.length > 0) {
    console.error("Found guild-scoped commands but DISCORD_TEST_GUILD_ID is missing.");
    console.error("Set DISCORD_TEST_GUILD_ID to deploy guild-only commands.");
    Deno.exit(1);
  }

  if (GUILD_ID) {
    console.log(`Deploying guild-scoped commands to ${GUILD_ID} (instant)`);
    await deployCommandSet(
      `guild ${GUILD_ID}`,
      `${RouteBases.api}/${Routes.applicationGuildCommands(APP_ID, GUILD_ID)}`,
      guildCommands,
    );
  }
}

deploy();
