export type PyodideLike = {
  runPythonAsync: (code: string) => Promise<string>;
};

export type ReplExecutionResult = {
  text: string;
  image: string | null;
};

export type ModalComponent = {
  custom_id?: string;
  value?: string;
};

export type ModalRow = {
  type?: number;
  components?: ModalComponent[];
};
