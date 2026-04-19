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
      && definition.type === 1
      && (
        moduleValue.scope === undefined
        || moduleValue.scope === "global"
        || moduleValue.scope === "guild"
      ),
  );
}

export async function discoverCommandModules(): Promise<CommandModule[]> {
  const commandsDirectory = new URL("./", import.meta.url);
  const modules: CommandModule[] = [];

  for await (const entry of Deno.readDir(commandsDirectory)) {
    if (!entry.isDirectory) {
      continue;
    }

    const modulePath = new URL(`${entry.name}/index.ts`, commandsDirectory);

    try {
      const stat = await Deno.stat(modulePath);
      console.log(`Found command module: ${entry.name}`);
      if (!stat.isFile) {
        continue;
      }
    } catch (error: unknown) {
      console.error(`Error occurred while reading ${entry.name}:`, error);
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }

    const imported = await import(modulePath.href);
    if (!isCommandModule(imported.default)) {
      console.error(`Invalid command module in ${entry.name}`);
      continue;
    }

    modules.push(imported.default);
  }

  modules.sort((a, b) => a.definition.name.localeCompare(b.definition.name));
  return modules;
}
