## Brightling ✨ - The ever-dedicated helper of the Umamusume Racing Society

Brightling is a domain-specific bot for our Discord, but it has a few limited set of commands that can be used by anyone. It is designed to be a helpful assistant for the members of our community, providing information and assistance related to the VRChat community.

She is designed to be easily deployed and require no gateway intents, which allows her to be deployed on platforms like Deno Deploy without any issues as she is just a simple HTTP server that responds to slash commands. She is also designed to be easily extendable, allowing us to add new commands and features as needed.

### Developing

Brightling is built using Deno, a modern JavaScript/TypeScript runtime. To get started with development, you can clone the repository and install the necessary dependencies.

```bash
$ git clone https://github.com/urs-vrc/Brightling.git
$ cd brightling
$ deno install -A
```

Then you can run the bot locally using the following command:

```bash
$ deno run --allow-net --allow-env main.ts
```

Alternatively, you can deploy your own copy of Brightling to Deno Deploy by following the instructions in the Deno Deploy documentation.

### So what isn't in the public version?

The open source version removes some experimental commands, some of them are interacting with my homelab and the agentic version of Brightling, which can interact in VRChat autonomously. Obviously, those features are not suitable for public use and may pose security risks if not properly configured. This version is specifically tailored to be a utilitarian assistant for the community.