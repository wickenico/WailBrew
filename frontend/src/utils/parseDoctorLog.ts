export type DoctorLogPart = { type: "text"; value: string } | { type: "command"; value: string };

const INLINE_BREW_COMMAND = /`(brew(?:\s+[^`\n]+)?)`/g;
const STANDALONE_BREW_COMMAND = /^(\s*)(brew(?:\s+.+)?)\s*$/;

// These subcommands are incomplete without at least one following target.
// Homebrew sometimes quotes just `brew install` while explaining what to do;
// that phrase should remain code-like text, not become an action button.
const TARGET_REQUIRED_SUBCOMMANDS = new Set([
    "install",
    "uninstall",
    "remove",
    "reinstall",
    "link",
    "unlink",
    "pin",
    "unpin",
    "extract",
]);

export function isActionableBrewCommand(command: string): boolean {
    const words = command.trim().split(/\s+/);
    if (words.length < 2 || words[0] !== "brew") return false;
    return !TARGET_REQUIRED_SUBCOMMANDS.has(words[1]) || words.length > 2;
}

export function parseDoctorLogLine(line: string): DoctorLogPart[] {
    const parts: DoctorLogPart[] = [];
    let lastIndex = 0;

    for (const match of line.matchAll(INLINE_BREW_COMMAND)) {
        const index = match.index ?? 0;
        if (index > lastIndex) {
            parts.push({ type: "text", value: line.slice(lastIndex, index) });
        }
        parts.push(
            isActionableBrewCommand(match[1])
                ? { type: "command", value: match[1] }
                : { type: "text", value: match[0] },
        );
        lastIndex = index + match[0].length;
    }

    if (parts.length > 0) {
        if (lastIndex < line.length) {
            parts.push({ type: "text", value: line.slice(lastIndex) });
        }
        return parts;
    }

    const standalone = line.match(STANDALONE_BREW_COMMAND);
    if (standalone && isActionableBrewCommand(standalone[2])) {
        return [
            { type: "text", value: standalone[1] },
            { type: "command", value: standalone[2] },
        ];
    }

    return [{ type: "text", value: line }];
}
