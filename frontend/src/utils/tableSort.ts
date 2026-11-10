export type SortValue = string | number;

/** Reads a field from a table row by its dynamic column key. */
export const getFieldValue = (item: object, key: string): unknown => Reflect.get(item, key);

/** Normalizes an arbitrary field value into something that can be compared with < and >. */
export const toSortValue = (value: unknown): SortValue => {
    if (value === undefined || value === null) return "";
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number" || typeof value === "string") return value;
    return String(value);
};

export const compareSortValues = (a: SortValue, b: SortValue, direction: "asc" | "desc"): number => {
    let comparison = 0;
    if (typeof a === "number" && typeof b === "number") {
        if (a < b) comparison = -1;
        if (a > b) comparison = 1;
    } else {
        // Mixed or string values (e.g. a missing field next to a number): compare as strings
        const left = String(a);
        const right = String(b);
        if (left < right) comparison = -1;
        if (left > right) comparison = 1;
    }
    return direction === "asc" ? comparison : -comparison;
};
