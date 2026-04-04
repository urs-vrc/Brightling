import type { CommandModule } from "./types.ts";

function isCommandModule(value: unknown): value is CommandModule {
  if (!value || typeof value !== "object") return false;

  const moduleValue = value as Partial<CommandModule>;
  const definition = moduleValue.definition;

  return Boolean(
    moduleValue.handleCommand
      && typeof moduleValue.handleCommand === "function"
      && definition
      && typeof definition.name === "string"
      && typeof definition.description === "string"
      && definition.type === 1,
  );
}

export async function discoverCommandModules(): Promise<CommandModule[]> {
  const commandsDirectory = new URL("./", import.meta.url);
  const modules: CommandModule[] = [];

  for await (const entry of Deno.readDir(commandsDirectory)) {
    if (!entry.isDirectory) {
      continue;
    }

    const moduleUrl = new URL(`${entry.name}/index.ts`, commandsDirectory).href;
    const imported = await import(moduleUrl);
    if (!isCommandModule(imported.default)) {
      throw new Error(`Invalid command module in ${entry.name}`);
    }

    modules.push(imported.default);
  }

  modules.sort((a, b) => a.definition.name.localeCompare(b.definition.name));
  return modules;
}
