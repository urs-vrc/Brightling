import { RouteBases, Routes } from "discord-api-types/rest-v10";
import type { ModalHandler, ModalHandlerResponse, ModalSubmitContext } from "../types.ts";
import { submitNewTeamToTeamDB, validateCSV } from "../../teamdb/utils.ts";
import { TEAMDB_MODAL_PREFIX } from "../../teamdb/index.ts";

type ModalComponent = {
  custom_id?: string;
  value?: string;
};

type ModalRow = {
  type?: number;
  components?: ModalComponent[];
};

const DEFERRED_RESPONSE_TYPE = 5;

function isTeamdbModal(customId: string): boolean {
  return customId.startsWith(TEAMDB_MODAL_PREFIX);
}

function extractFieldValue(data: unknown, fieldId: string): string {
  const modalData = data as { components?: ModalRow[] };
  const rows = modalData.components ?? [];

  for (const row of rows) {
    for (const component of row.components ?? []) {
      if (component.custom_id === fieldId) {
        return component.value?.trim() ?? "";
      }
    }
  }

  return "";
}

async function sendDiscordResponse(
  applicationId: string,
  token: string,
  content: string,
): Promise<void> {
  const url = `${RouteBases.api}${Routes.webhookMessage(applicationId, token, "@original")}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content,
      flags: 64,
    }),
  });

  if (!response.ok) {
    console.error("Failed to send TeamDB modal follow-up:", await response.text());
  }
}

function buildSuccessMessage(handle: string, fqdn: string, description: string): string {
  return [
    "Team submission successful.",
    "",
    `Handle: ${handle}`,
    `FQDN: ${fqdn}`,
    `Description: ${description || "(none)"}`,
    "",
    "Your submission has been received. A PR should appear shortly in https://github.com/urs-vrc/teamdb if validation passes.",
  ].join("\n");
}

function buildErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("secret") || lowerMessage.includes("github_token")) {
    return "Bot configuration error. Contact the owner.";
  }

  return `Submission failed: ${message || "Unknown error"}`;
}

function validateSubmission(handle: string, fqdn: string, membersCsv: string): string | null {
  if (!handle || !fqdn || !membersCsv) {
    return "Missing required fields.";
  }

  if (handle.length < 3 || handle.length > 4) {
    return "Team handle must be 3-4 characters.";
  }

  return null;
}

function handleTeamdbModalSubmit(input: ModalSubmitContext): ModalHandlerResponse {
  const handle = extractFieldValue(input.data, "team_handle");
  const fqdn = extractFieldValue(input.data, "team_fqdn");
  const description = extractFieldValue(input.data, "team_description");
  const membersCsv = extractFieldValue(input.data, "members_csv");

  queueMicrotask(async () => {
    try {
      const validationError = validateSubmission(handle, fqdn, membersCsv);
      if (validationError) {
        await sendDiscordResponse(input.applicationId, input.token, validationError);
        return;
      }

      const csvValidation = await validateCSV(membersCsv);
      if (!csvValidation.isValid) {
        await sendDiscordResponse(
          input.applicationId,
          input.token,
          `Members CSV is invalid: ${csvValidation.error ?? "Unknown CSV validation error."}\nAre you lost? Check the template: https://github.com/urs-vrc/teamdb/tree/main/.template`,
        );
        return;
      }

      await submitNewTeamToTeamDB(handle, fqdn, description, membersCsv);
      await sendDiscordResponse(
        input.applicationId,
        input.token,
        buildSuccessMessage(handle, fqdn, description),
      );
    } catch (error) {
      console.error("TeamDB modal submission failed:", error);
      await sendDiscordResponse(input.applicationId, input.token, buildErrorMessage(error));
    }
  });

  return {
    type: DEFERRED_RESPONSE_TYPE,
    data: { flags: 64 },
  };
}

const handler: ModalHandler = {
  name: "teamdb",
  canHandle: isTeamdbModal,
  handle: handleTeamdbModalSubmit,
};

export default handler;
