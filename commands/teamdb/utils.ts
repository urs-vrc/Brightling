import { Octokit } from "octokit";
import { parse } from "@std/csv";

type SchemaFieldConstraints = {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
};

type SchemaField = {
	name: string;
	type: string;
	constraints?: SchemaFieldConstraints;
};

type MembersTableSchema = {
	fields: SchemaField[];
};

export type CSVValidationResult = {
	isValid: boolean;
	error: string | null;
};

const TEAMDB_MEMBERS_SCHEMA_URL =
	"https://raw.githubusercontent.com/urs-vrc/teamdb/refs/heads/main/.schema/members.table.schema.json";

/**
 * Encodes the CSV data into base64 format for workflow dispatch
 * @param csvData The CSV data to encode
 * @returns The base64 encoded string of the CSV data
 */
export function encodeCSVToBase64(csvData: string): string {
	// check if we have the first row with the header, if so, strip it out
	// since the GitHub Actions workflow rebuilds it with the header
	if (csvData.startsWith("discord_name,vrc_name,runstyle,role")) {
		csvData = csvData.split("\n").slice(1).join("\n");
	}
	return btoa(csvData);
}

export async function validateCSV(csvData: string): Promise<CSVValidationResult> {
	if (!csvData.trim()) {
		return { isValid: false, error: "Members CSV is empty." };
	}

	try {
		const response = await fetch(TEAMDB_MEMBERS_SCHEMA_URL);
		if (!response.ok) {
			return {
				isValid: false,
				error: `Could not fetch TeamDB schema (${response.status} ${response.statusText}).`,
			};
		}

		const schema = await response.json() as MembersTableSchema;
		const parsedRows = parse(csvData) as string[][];
		const rows = parsedRows.filter((row) => row.some((column) => column.trim() !== ""));

		if (rows.length === 0) {
			return { isValid: false, error: "No data rows were provided." };
		}

		const expectedColumns = schema.fields.length;
		const expectedHeader = schema.fields.map((field) => field.name);
		const hasHeader = rows[0].length === expectedColumns &&
			rows[0].every((column, index) => column.trim() === expectedHeader[index]);
		const dataRows = hasHeader ? rows.slice(1) : rows;

		if (dataRows.length === 0) {
			return { isValid: false, error: "CSV contains a header but no member rows." };
		}

		for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
			const row = dataRows[rowIndex];
			const sourceRowNumber = rowIndex + 1 + (hasHeader ? 1 : 0);
			if (row.length !== expectedColumns) {
				return {
					isValid: false,
					error:
						`Row ${sourceRowNumber} has ${row.length} columns, but ${expectedColumns} are required.`,
				};
			}

			for (let fieldIndex = 0; fieldIndex < schema.fields.length; fieldIndex++) {
				const field = schema.fields[fieldIndex];
				const rawValue = row[fieldIndex] ?? "";
				const value = rawValue.trim();
				const constraints = field.constraints ?? {};

				if (constraints.required && value.length === 0) {
					return {
						isValid: false,
						error: `Row ${sourceRowNumber} is missing required value for "${field.name}".`,
					};
				}

				if (field.type === "string") {
					if (constraints.minLength !== undefined && value.length < constraints.minLength) {
						return {
							isValid: false,
							error:
								`Row ${sourceRowNumber} field "${field.name}" must be at least ${constraints.minLength} characters.`,
						};
					}

					if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
						return {
							isValid: false,
							error:
								`Row ${sourceRowNumber} field "${field.name}" must be at most ${constraints.maxLength} characters.`,
						};
					}
				}

				if (field.type === "integer") {
					const numericValue = Number(value);
					if (!Number.isInteger(numericValue)) {
						return {
							isValid: false,
							error: `Row ${sourceRowNumber} field "${field.name}" must be an integer.`,
						};
					}

					if (constraints.minimum !== undefined && numericValue < constraints.minimum) {
						return {
							isValid: false,
							error:
								`Row ${sourceRowNumber} field "${field.name}" must be >= ${constraints.minimum}.`,
						};
					}
				}
			}
		}

		return { isValid: true, error: null };
	} catch (error) {
		console.error("Error validating CSV against schema:", error);
		return { isValid: false, error: "Could not parse CSV. Verify formatting and try again." };
	}
}

/**
 * deletes a row from the CSV data based on the given index and returns the updated CSV string
 * @param csvData The original CSV data as a string
 * @param rowIdx The index of the row to delete (0-based)
 * @returns The updated CSV data as a string with the specified row removed
 */
export function deleteCSVRow(csvData: string, rowIdx: number): string {
	// find the row with the given index and remove it
	const rows = csvData.split("\n");
	rows.splice(rowIdx, 1);
	return rows.join("\n");
}

/**
 * append a new row to the end of the CSV data and return the updated CSV string
 * @param csvData  The original CSV data as a string
 * @param newRow  The new row to append, as a string
 * @returns The updated CSV data as a string with the new row appended
 */
export function appendCSVRow(csvData: string, newRow: string): string {
	// append the new row to the end of the CSV data
	if (!csvData.endsWith("\n")) {
		csvData += "\n";
	}
	return csvData + newRow + "\n";
}

/**
 * Submits a new team to the TeamDB via the official brightling-submit workflow.
 * This is the main integration point with https://github.com/urs-vrc/teamdb/.github/workflows/brightling-submit.yaml
 */
export async function submitNewTeamToTeamDB(
	handle: string,
	fqdn: string,
	description: string = "",
	teamColor: string = "",
	membersCsvLines: string,
) {
	const githubToken = Deno.env.get("GITHUB_TOKEN");
	const submissionSecret = Deno.env.get("TEAM_SUBMISSION_SECRET");

	if (!githubToken) {
		throw new Error("Missing GITHUB_TOKEN in environment — cannot submit to TeamDB");
	}
	if (!submissionSecret) {
		throw new Error("Missing TEAM_SUBMISSION_SECRET in environment");
	}

	const octokit = new Octokit({ auth: githubToken });

	try {
		await octokit.request("POST /repos/urs-vrc/teamdb/actions/workflows/brightling-submit.yaml/dispatches", {
			ref: "main",
			inputs: {
				team_handle: handle,
				team_fqdn: fqdn,
				team_description: description,
				team_color: teamColor,
				members_csv_lines: membersCsvLines,
				submission_secret: submissionSecret,
			},
		});

		console.log(`✅ Workflow dispatch sent for team ${handle} (${fqdn})`);
		return { success: true, handle, fqdn };
	} catch (error) {
		console.error("❌ Failed to dispatch team submission workflow:", error);
		throw error;
	}
}