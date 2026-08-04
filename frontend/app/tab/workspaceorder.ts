// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type WorkspaceDropPosition = "before" | "after";

type OrderedWorkspaceEntry = {
    workspace: {
        oid: string;
    };
};

export function reorderWorkspaces<T extends OrderedWorkspaceEntry>(
    entries: T[],
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    position: WorkspaceDropPosition
): T[] {
    if (sourceWorkspaceId === targetWorkspaceId) {
        return entries;
    }

    const sourceIndex = entries.findIndex((entry) => entry.workspace.oid === sourceWorkspaceId);
    const targetIndex = entries.findIndex((entry) => entry.workspace.oid === targetWorkspaceId);
    if (sourceIndex === -1 || targetIndex === -1) {
        return entries;
    }

    const reordered = [...entries];
    const [sourceEntry] = reordered.splice(sourceIndex, 1);
    const remainingTargetIndex = reordered.findIndex((entry) => entry.workspace.oid === targetWorkspaceId);
    const insertionIndex = remainingTargetIndex + (position === "after" ? 1 : 0);
    reordered.splice(insertionIndex, 0, sourceEntry);
    return reordered;
}
