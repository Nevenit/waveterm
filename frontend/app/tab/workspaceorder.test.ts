// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { reorderWorkspaces } from "./workspaceorder";

const entries = ["a", "b", "c", "d"].map((oid) => ({ workspace: { oid } }));
const ids = (orderedEntries: typeof entries) => orderedEntries.map((entry) => entry.workspace.oid);

describe("reorderWorkspaces", () => {
    it("moves a workspace before another workspace", () => {
        expect(ids(reorderWorkspaces(entries, "d", "b", "before"))).toEqual(["a", "d", "b", "c"]);
    });

    it("moves a workspace after another workspace", () => {
        expect(ids(reorderWorkspaces(entries, "a", "c", "after"))).toEqual(["b", "c", "a", "d"]);
    });

    it("returns the same list for an invalid or unchanged move", () => {
        expect(reorderWorkspaces(entries, "b", "b", "before")).toBe(entries);
        expect(reorderWorkspaces(entries, "missing", "b", "before")).toBe(entries);
    });
});
