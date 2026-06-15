export interface ParsedInfo {
    headline: string;
    description?: string;
    homepage?: string;
    entries: Array<{ label: string; value: string }>;
}

/**
 * Parses the raw text output of `brew info <package>` into structured data.
 *
 * Sections like "==> Caveats" contain unstructured prose and are deliberately
 * skipped so their content does not corrupt subsequent structured sections
 * like "==> Analytics".
 */
export function parseInfoLog(log: string | null): ParsedInfo | null {
    if (!log) return null;

    const lines = log.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const entries: Array<{ label: string; value: string }> = [];
    let headline = "";
    let description = "";
    let homepage = "";
    let skipSection = false;

    for (const line of lines) {
        if (line.startsWith("==>")) {
            const sectionName = line.replace(/^==>\s*/, "");
            // Caveats is free-form prose — skip its content to avoid garbling subsequent sections
            skipSection = sectionName === "Caveats";

            if (!headline) {
                headline = sectionName;
            } else if (!skipSection) {
                entries.push({ label: "Section", value: sectionName });
            }
            continue;
        }

        if (skipSection) continue;

        if (!homepage && /^https?:\/\//i.test(line)) {
            homepage = line;
            continue;
        }

        if (!description && !line.includes(":") && !line.startsWith("/")) {
            description = line;
            continue;
        }

        if (line.startsWith("Installed ")) continue;

        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
            entries.push({ label: match[1].trim(), value: match[2].trim() });
            continue;
        }

        if (line.startsWith("/")) {
            entries.push({ label: "Path", value: line });
            continue;
        }
    }

    if (!headline && entries.length === 0 && !description && !homepage) {
        return null;
    }

    return { headline: headline || "Package Information", description, homepage, entries };
}
