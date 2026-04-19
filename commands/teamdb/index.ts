import { ApplicationCommandOptionType, InteractionResponseType } from "discord-api-types/v10";
import type { CommandModule } from "../types.ts";

const TEAMDB_MODAL_PREFIX = "teamdb_submit_modal_";

function getSubcommandName(interaction: unknown): string {
  const data = (interaction as { data?: { options?: Array<{ name?: string; type?: number }> } })?.data;
  const maybeSubcommand = data?.options?.find((option) => option.type === ApplicationCommandOptionType.Subcommand);
  return maybeSubcommand?.name ?? "";
}

function buildTeamdbSubmitModalCustomId(userId: string | undefined): string {
  return `${TEAMDB_MODAL_PREFIX}${Date.now()}_${userId ?? "anon"}`;
}

const teamdbCommand: CommandModule = {
  scope: "global",
  definition: {
    name: "teamdb",
    description: "TeamDB integrations",
    type: 1,
    options: [
      {
        name: "submit",
        description: "Submit a new team via modal",
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },
  handleCommand(context) {
    const subcommandName = getSubcommandName(context.interaction);

    if (subcommandName !== "submit") {
      return Promise.resolve({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Unknown subcommand. Use `/teamdb submit`.",
          flags: 64,
        },
      });
    }

    const userId = context.interaction.member?.user?.id;

    return Promise.resolve({
      type: InteractionResponseType.Modal,
      data: {
        custom_id: buildTeamdbSubmitModalCustomId(userId),
        title: "Submit New Team to TeamDB",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "team_handle",
                label: "Team Handle",
                placeholder: "GREY",
                style: 1,
                required: true,
                min_length: 3,
                max_length: 5,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "team_fqdn",
                label: "Team Name",
                placeholder: "Greycoats",
                style: 1,
                required: true,
                min_length: 3,
                max_length: 32,

              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "team_description",
                label: "Description (optional)",
                placeholder: "Put something descriptive here! This will show up in the TeamDB listing.",
                style: 2,
                required: false,
                max_length: 500,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "members_csv",
                label: "Members CSV (one per line)",
                placeholder: "sr229,Minori みのり,EC+LS,0\\nalyca,Alyca,EC+LS,1",
                style: 2,
                required: true,
                min_length: 10,
                max_length: 2000,
              },
            ],
          },
        ],
      },
    });
  },
};

export default teamdbCommand;

export { TEAMDB_MODAL_PREFIX };
