export function sanitizeFTS5(query) {
    // FTS5 operators to reject/remove
    const fts5Operators = ["AND", "OR", "NOT", "NEAR"];
    // Split on whitespace
    const tokens = query.split(/\s+/).filter((t) => t.length > 0);
    const sanitized = [];
    for (const token of tokens) {
        const upper = token.toUpperCase();
        // Skip FTS5 operators
        if (fts5Operators.includes(upper)) {
            continue;
        }
        // Skip single * (wildcard) but keep word*
        if (token === "*") {
            continue;
        }
        // Skip parentheses
        if (token === "(" || token === ")") {
            continue;
        }
        // Escape inner " to "" then wrap in double quotes
        const escaped = token.replace(/"/g, '""');
        sanitized.push(`"${escaped}"`);
    }
    // Join with space (implicit AND in FTS5)
    return sanitized.join(" ");
}
//# sourceMappingURL=fts5-utils.js.map