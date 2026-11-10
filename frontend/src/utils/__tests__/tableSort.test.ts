import { describe, expect, it } from "vitest";
import { compareSortValues, getFieldValue, toSortValue } from "../tableSort";

describe("getFieldValue", () => {
    it("reads a field by dynamic key", () => {
        expect(getFieldValue({ name: "wget", size: "1 MB" }, "name")).toBe("wget");
    });

    it("returns undefined for unknown keys", () => {
        expect(getFieldValue({ name: "wget" }, "missing")).toBeUndefined();
    });
});

describe("toSortValue", () => {
    it("maps undefined and null to an empty string", () => {
        expect(toSortValue(undefined)).toBe("");
        expect(toSortValue(null)).toBe("");
    });

    it("maps booleans to 1 and 0", () => {
        expect(toSortValue(true)).toBe(1);
        expect(toSortValue(false)).toBe(0);
    });

    it("keeps strings and numbers as they are", () => {
        expect(toSortValue("a")).toBe("a");
        expect(toSortValue(42)).toBe(42);
    });

    it("stringifies other values", () => {
        expect(toSortValue(["a", "b"])).toBe("a,b");
    });
});

describe("compareSortValues", () => {
    it("sorts strings ascending and descending", () => {
        expect(compareSortValues("a", "b", "asc")).toBe(-1);
        expect(compareSortValues("a", "b", "desc")).toBe(1);
        expect(compareSortValues("b", "b", "asc")).toBe(0);
    });

    it("compares numbers numerically, not lexicographically", () => {
        expect(compareSortValues(9, 10, "asc")).toBe(-1);
    });

    it("sorts a missing value before a present one", () => {
        expect(compareSortValues("", "a", "asc")).toBe(-1);
    });
});
