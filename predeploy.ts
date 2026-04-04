import { RouteBases, Routes } from "discord-api-types/rest-v10";
import axios, { AxiosError } from "axios";
import { discoverCommandModules } from "./commands/registry.ts";

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN");
const APP_ID = Deno.env.get("DISCORD_APP_ID")!;
const GUILD_ID = Deno.env.get("DISCORD_TEST_GUILD_ID")!; // comment out for global

if (!DISCORD_TOKEN || !APP_ID) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in .env");
  Deno.exit(1);
}

const headers = {
  "Authorization": `Bot ${DISCORD_TOKEN}`,
  "Content-Type": "application/json",
};

async function deploy() {
  const commandModules = await discoverCommandModules();
  const commands = commandModules.map((module) => module.definition);

  let url: string;

  if (GUILD_ID) {
    console.log(`Deploying to guild ${GUILD_ID} (instant)`);
    url = `${RouteBases.api}/${Routes.applicationGuildCommands(APP_ID, GUILD_ID)}`;
  } else {
    console.log(
      "Deploying globally (may take up to 1 hour to appear everywhere)",
    );
    url = `${RouteBases.api}/${Routes.applicationCommands(APP_ID)}`;
  }

  try {
    const response = await axios.put(url, commands, { headers });
    console.log("Success! Registered commands:", response.data);
  } catch (error: unknown) {
    const err = error as AxiosError;
    console.error("Failed to register commands:");
    console.error(err.response?.data || err.message);
    if (err.response?.status === 429) {
      console.error("Rate limited — wait and retry");
    }
  }
}

deploy();
