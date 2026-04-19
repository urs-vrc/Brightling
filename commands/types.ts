export type CommandDefinition = {
  name: string;
  description: string;
  type: 1;
  options?: Array<{
    type: number;
    name: string;
    description: string;
    required?: boolean;
    options?: Array<{
      type: number;
      name: string;
      description: string;
      required?: boolean;
    }>;
  }>;
};

export type CommandScope = "global" | "guild";

export type CommandContext = {
  interaction: {
    member?: {
      user?: {
        id?: string;
      };
    };
  };
  requestStartedAt: number;
};

export type CommandModule = {
  definition: CommandDefinition;
  scope?: CommandScope;
  handleCommand: (
    context: CommandContext,
  ) => Promise<{
    type: number;
    data?: Record<string, unknown>;
  }>;
};
