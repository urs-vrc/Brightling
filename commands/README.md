# Creating a Command

This folder is auto-discovered by the app at runtime. Each command lives in its own subfolder and exposes a default `CommandModule` from `index.ts`.

## How command loading works

- `discoverCommandModules()` in `commands/registry.ts` scans each subdirectory in `commands/`.
- It imports `<folder>/index.ts` and validates that the default export matches `CommandModule`.
- Modules are sorted by command name and then used by:
	- `predeploy.ts` for slash command registration.
	- `main.ts` for handling incoming `ApplicationCommand` interactions.

If a command folder does not export a valid module, startup or deployment will fail with `Invalid command module in <folder>`.

## Step-by-step

1. Create a new folder under `commands/`.
2. Add `index.ts` in that folder.
3. Export a default object that satisfies `CommandModule`.
4. Set `definition.name`, `definition.description`, and `definition.type` (`1` for slash command).
5. Implement `handleCommand(context)` and return a Discord interaction response.
6. Optionally set `scope`:
	 - Omit or use `"global"` for global commands.
	 - Use `"guild"` for guild-only commands.
7. Run `predeploy.ts` to publish updated command definitions to Discord.

## Command contract

From `commands/types.ts`:

- `definition`: command metadata sent to Discord.
- `scope`: `"global" | "guild"`.
- `handleCommand`: async handler returning `{ type, data? }`.
- `context.requestStartedAt`: useful for latency/timing responses.
- `context.interaction`: raw Discord interaction payload.

## Minimal template

```ts
import { InteractionResponseType } from "discord-api-types/v10";
import type { CommandModule } from "../types.ts";

const helloCommand: CommandModule = {
	scope: "global",
	definition: {
		name: "hello",
		description: "Say hello",
		type: 1,
	},
	async handleCommand() {
		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: "Hello from Brightling!",
			},
		};
	},
};

export default helloCommand;
```

## Registration and testing

1. Ensure env vars are set:
	 - `DISCORD_TOKEN`
	 - `DISCORD_APP_ID`
	 - `DISCORD_TEST_GUILD_ID` (required if you create any `scope: "guild"` command)
2. Deploy command definitions:

```bash
deno run --allow-env --allow-net predeploy.ts
```

3. Start the interaction endpoint:

```bash
deno run --allow-env --allow-net main.ts
```

## Optional: modal-based commands

If your command opens a modal (`type: 9`), also add a modal submit handler in `commands/modal/handlers/`.

- The command should set a stable `custom_id` prefix.
- Add a handler module that exports a `ModalHandler` with:
	- `canHandle(customId)` to match that prefix.
	- `handle(context)` to process submission and return a response.

Use `repl` as a reference implementation:

- Command: `commands/repl/index.ts`
- Modal router: `commands/modal/registry.ts`
- Handler: `commands/modal/handlers/repl.ts`
