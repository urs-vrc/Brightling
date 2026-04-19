import { Octokit } from "octokit";

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
			owner: "urs-vrc",
			repo: "teamdb",
			ref: "main",
			inputs: {
				team_handle: handle,
				team_fqdn: fqdn,
				team_description: description,
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