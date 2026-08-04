// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useWaveEnv, WaveEnv, WaveEnvSubset } from "@/app/waveenv/waveenv";
import {
    ExpandableMenu,
    ExpandableMenuItem,
    ExpandableMenuItemGroup,
    ExpandableMenuItemGroupTitle,
    ExpandableMenuItemLeftElement,
    ExpandableMenuItemRightElement,
} from "@/element/expandablemenu";
import { Popover, PopoverButton, PopoverContent } from "@/element/popover";
import { fireAndForget, makeIconClass, useAtomValueSafe } from "@/util/util";
import clsx from "clsx";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { CSSProperties, forwardRef, useCallback, useEffect, useState } from "react";
import WorkspaceSVG from "../asset/workspace.svg";
import { IconButton } from "../element/iconbutton";
import { globalStore } from "@/app/store/jotaiStore";
import { makeORef } from "../store/wos";
import { waveEventSubscribeSingle } from "../store/wps";
import { WorkspaceEditor } from "./workspaceeditor";
import { reorderWorkspaces, WorkspaceDropPosition } from "./workspaceorder";
import "./workspaceswitcher.scss";

export type WorkspaceSwitcherEnv = WaveEnvSubset<{
    electron: {
        deleteWorkspace: WaveEnv["electron"]["deleteWorkspace"];
        createWorkspace: WaveEnv["electron"]["createWorkspace"];
        switchWorkspace: WaveEnv["electron"]["switchWorkspace"];
    };
    atoms: {
        workspace: WaveEnv["atoms"]["workspace"];
    };
    services: {
        workspace: WaveEnv["services"]["workspace"];
    };
    wos: WaveEnv["wos"];
}>;

type WorkspaceListEntry = {
    windowId: string;
    workspace: Workspace;
};

type WorkspaceList = WorkspaceListEntry[];
const workspaceMapAtom = atom<WorkspaceList>([]);
const editingWorkspaceAtom = atom<string>();
const WorkspaceSwitcher = forwardRef<HTMLDivElement>((_, ref) => {
    const env = useWaveEnv<WorkspaceSwitcherEnv>();
    const setWorkspaceList = useSetAtom(workspaceMapAtom);
    const activeWorkspace = useAtomValueSafe(env.atoms.workspace);
    const workspaceList = useAtomValue(workspaceMapAtom);
    const setEditingWorkspace = useSetAtom(editingWorkspaceAtom);
    const [draggedWorkspaceId, setDraggedWorkspaceId] = useState<string>();
    const [dropTarget, setDropTarget] = useState<{
        workspaceId: string;
        position: WorkspaceDropPosition;
    }>();

    const updateWorkspaceList = useCallback(async () => {
        const workspaceList = await env.services.workspace.ListWorkspaces();
        if (!workspaceList) {
            return;
        }
        const newList: WorkspaceList = [];
        for (const entry of workspaceList) {
            // This just ensures that the atom exists for easier setting of the object
            globalStore.get(env.wos.getWaveObjectAtom(makeORef("workspace", entry.workspaceid)));
            newList.push({
                windowId: entry.windowid,
                workspace: await env.services.workspace.GetWorkspace(entry.workspaceid),
            });
        }
        setWorkspaceList(newList);
    }, [env.services.workspace, env.wos, setWorkspaceList]);

    useEffect(
        () =>
            waveEventSubscribeSingle({
                eventType: "workspace:update",
                handler: () => fireAndForget(updateWorkspaceList),
            }),
        [updateWorkspaceList]
    );

    useEffect(() => {
        fireAndForget(updateWorkspaceList);
    }, [updateWorkspaceList]);

    const onDeleteWorkspace = useCallback((workspaceId: string) => {
        env.electron.deleteWorkspace(workspaceId);
    }, [env.electron]);

    const clearDragState = useCallback(() => {
        setDraggedWorkspaceId(undefined);
        setDropTarget(undefined);
    }, []);

    const onReorderWorkspace = useCallback(
        (sourceWorkspaceId: string, targetWorkspaceId: string, position: WorkspaceDropPosition) => {
            const reordered = reorderWorkspaces(workspaceList, sourceWorkspaceId, targetWorkspaceId, position);
            if (reordered === workspaceList) {
                clearDragState();
                return;
            }

            setWorkspaceList(reordered);
            clearDragState();
            fireAndForget(async () => {
                try {
                    await env.services.workspace.SetWorkspaceOrder(
                        reordered.map((entry) => entry.workspace.oid)
                    );
                } catch (error) {
                    await updateWorkspaceList();
                    throw error;
                }
            });
        },
        [clearDragState, env.services.workspace, setWorkspaceList, updateWorkspaceList, workspaceList]
    );

    const isActiveWorkspaceSaved = !!(activeWorkspace.name && activeWorkspace.icon);

    const workspaceIcon = isActiveWorkspaceSaved ? (
        <i className={makeIconClass(activeWorkspace.icon, false)} style={{ color: activeWorkspace.color }}></i>
    ) : (
        <WorkspaceSVG />
    );

    const saveWorkspace = () => {
        fireAndForget(async () => {
            await env.services.workspace.UpdateWorkspace(activeWorkspace.oid, "", "", "", true);
            await updateWorkspaceList();
            setEditingWorkspace(activeWorkspace.oid);
        });
    };

    return (
        <Popover
            className="workspace-switcher-popover"
            placement="bottom-start"
            onDismiss={() => setEditingWorkspace(null)}
            ref={ref}
        >
            <PopoverButton
                className="workspace-switcher-button grey"
                as="div"
                onClick={() => {
                    fireAndForget(updateWorkspaceList);
                }}
            >
                <span className="workspace-icon">{workspaceIcon}</span>
            </PopoverButton>
            <PopoverContent className="workspace-switcher-content">
                <div className="title">{isActiveWorkspaceSaved ? "Switch workspace" : "Open workspace"}</div>
                <OverlayScrollbarsComponent className={"scrollable"} options={{ scrollbars: { autoHide: "leave" } }}>
                    <ExpandableMenu noIndent singleOpen>
                        {workspaceList.map((entry) => (
                            <WorkspaceSwitcherItem
                                key={entry.workspace.oid}
                                workspaceEntry={entry}
                                isDragging={draggedWorkspaceId === entry.workspace.oid}
                                dropPosition={
                                    dropTarget?.workspaceId === entry.workspace.oid ? dropTarget.position : undefined
                                }
                                onDragStart={setDraggedWorkspaceId}
                                onDragOver={(workspaceId, position) => setDropTarget({ workspaceId, position })}
                                onDrop={onReorderWorkspace}
                                onDragEnd={clearDragState}
                                onWorkspaceEntryChange={(nextEntry) =>
                                    setWorkspaceList((entries) =>
                                        entries.map((currentEntry) =>
                                            currentEntry.workspace.oid === nextEntry.workspace.oid
                                                ? nextEntry
                                                : currentEntry
                                        )
                                    )
                                }
                                onDeleteWorkspace={onDeleteWorkspace}
                            />
                        ))}
                    </ExpandableMenu>
                </OverlayScrollbarsComponent>

                <div className="actions">
                    {isActiveWorkspaceSaved ? (
                        <ExpandableMenuItem onClick={() => env.electron.createWorkspace()}>
                            <ExpandableMenuItemLeftElement>
                                <i className="fa-sharp fa-solid fa-plus"></i>
                            </ExpandableMenuItemLeftElement>
                            <div className="content">Create new workspace</div>
                        </ExpandableMenuItem>
                    ) : (
                        <ExpandableMenuItem onClick={() => saveWorkspace()}>
                            <ExpandableMenuItemLeftElement>
                                <i className="fa-sharp fa-solid fa-floppy-disk"></i>
                            </ExpandableMenuItemLeftElement>
                            <div className="content">Save workspace</div>
                        </ExpandableMenuItem>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
});

const WorkspaceSwitcherItem = ({
    workspaceEntry,
    isDragging,
    dropPosition,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onWorkspaceEntryChange,
    onDeleteWorkspace,
}: {
    workspaceEntry: WorkspaceListEntry;
    isDragging: boolean;
    dropPosition?: WorkspaceDropPosition;
    onDragStart: (workspaceId: string) => void;
    onDragOver: (workspaceId: string, position: WorkspaceDropPosition) => void;
    onDrop: (sourceWorkspaceId: string, targetWorkspaceId: string, position: WorkspaceDropPosition) => void;
    onDragEnd: () => void;
    onWorkspaceEntryChange: (entry: WorkspaceListEntry) => void;
    onDeleteWorkspace: (workspaceId: string) => void;
}) => {
    const env = useWaveEnv<WorkspaceSwitcherEnv>();
    const activeWorkspace = useAtomValueSafe(env.atoms.workspace);
    const [editingWorkspace, setEditingWorkspace] = useAtom(editingWorkspaceAtom);

    const workspace = workspaceEntry.workspace;
    const isCurrentWorkspace = activeWorkspace.oid === workspace.oid;

    const setWorkspace = useCallback(
        (newWorkspace: Workspace) => {
            onWorkspaceEntryChange({ ...workspaceEntry, workspace: newWorkspace });
            if (newWorkspace.name != "") {
                fireAndForget(() =>
                    env.services.workspace.UpdateWorkspace(
                        workspace.oid,
                        newWorkspace.name,
                        newWorkspace.icon,
                        newWorkspace.color,
                        false
                    )
                );
            }
        },
        [env.services.workspace, onWorkspaceEntryChange, workspace.oid, workspaceEntry]
    );

    const isActive = !!workspaceEntry.windowId;
    const editIconDecl: IconButtonDecl = {
        elemtype: "iconbutton",
        className: "edit",
        icon: "pencil",
        title: "Edit workspace",
        click: (e) => {
            e.stopPropagation();
            if (editingWorkspace === workspace.oid) {
                setEditingWorkspace(null);
            } else {
                setEditingWorkspace(workspace.oid);
            }
        },
    };
    const windowIconDecl: IconButtonDecl = {
        elemtype: "iconbutton",
        className: "window",
        noAction: true,
        icon: isCurrentWorkspace ? "check" : "window",
        title: isCurrentWorkspace ? "This is your current workspace" : "This workspace is open",
    };

    const isEditing = editingWorkspace === workspace.oid;

    return (
        <ExpandableMenuItemGroup
            key={workspace.oid}
            isOpen={isEditing}
            className={clsx({
                "is-current": isCurrentWorkspace,
                "is-dragging": isDragging,
                "drop-before": dropPosition === "before",
                "drop-after": dropPosition === "after",
            })}
        >
            <ExpandableMenuItemGroupTitle
                onClick={() => {
                    env.electron.switchWorkspace(workspace.oid);
                    // Create a fake escape key event to close the popover
                    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                }}
            >
                <div
                    className="menu-group-title-wrapper"
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", workspace.oid);
                        onDragStart(workspace.oid);
                    }}
                    onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        const rect = event.currentTarget.getBoundingClientRect();
                        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                        onDragOver(workspace.oid, position);
                    }}
                    onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const sourceWorkspaceId = event.dataTransfer.getData("text/plain");
                        if (sourceWorkspaceId && dropPosition) {
                            onDrop(sourceWorkspaceId, workspace.oid, dropPosition);
                        } else {
                            onDragEnd();
                        }
                    }}
                    onDragEnd={onDragEnd}
                    style={
                        {
                            "--workspace-color": workspace.color,
                        } as CSSProperties
                    }
                >
                    <ExpandableMenuItemLeftElement>
                        <i className="drag-handle fa-sharp fa-solid fa-grip-vertical" title="Drag to reorder" />
                        <i
                            className={clsx("left-icon", makeIconClass(workspace.icon, true))}
                            style={{ color: workspace.color }}
                        />
                    </ExpandableMenuItemLeftElement>
                    <div className="label">{workspace.name}</div>
                    <ExpandableMenuItemRightElement>
                        <div className="icons">
                            <IconButton decl={editIconDecl} />
                            {isActive && <IconButton decl={windowIconDecl} />}
                        </div>
                    </ExpandableMenuItemRightElement>
                </div>
            </ExpandableMenuItemGroupTitle>
            <ExpandableMenuItem>
                <WorkspaceEditor
                    title={workspace.name}
                    icon={workspace.icon}
                    color={workspace.color}
                    focusInput={isEditing}
                    onTitleChange={(title) => setWorkspace({ ...workspace, name: title })}
                    onColorChange={(color) => setWorkspace({ ...workspace, color })}
                    onIconChange={(icon) => setWorkspace({ ...workspace, icon })}
                    onDeleteWorkspace={() => onDeleteWorkspace(workspace.oid)}
                />
            </ExpandableMenuItem>
        </ExpandableMenuItemGroup>
    );
};

export { WorkspaceSwitcher };
