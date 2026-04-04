export type ModalSubmitData = {
  custom_id?: string;
  [key: string]: unknown;
};

export type ModalSubmitContext = {
  applicationId: string;
  token: string;
  data: ModalSubmitData;
};

export type ModalHandlerResponse = {
  type: number;
  data?: Record<string, unknown>;
};

export type ModalHandler = {
  name: string;
  canHandle: (customId: string) => boolean;
  handle: (context: ModalSubmitContext) => ModalHandlerResponse | Promise<ModalHandlerResponse>;
};
