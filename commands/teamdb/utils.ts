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
 * Triggers the GitHub Actions workflow to update the TeamDB with the provided CSV data.
 * @param handle The TeamDB handle to update 
 * @param csvData The CSV data to update the TeamDB with, as a string
 */
export function triggerTeamDBUpdate(handle: string, csvData: string) {
	const githubToken = Deno.env.get("GITHUB_TOKEN");

	if (!githubToken)
		throw new Error("Missing GITHUB_TOKEN in .env, cannot perform transaction");

	const octokit = new Octokit({ auth: githubToken });
	const encodedCSV = encodeCSVToBase64(csvData);

	octokit.request("POST /repos/urs-vrc/teamdb/actions/workflows/brightling-submit.yaml/dispatches", {
		owner: "urs-vrc",
		repo: "teamdb",
		ref: "main",
		inputs: {
			handle,
			csv_data: encodedCSV,
		},
	});

	// TODO: figure out what to do next here, my brain short-circuited at this point
	// はりきって行こう！
}