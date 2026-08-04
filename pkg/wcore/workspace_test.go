// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wcore

import (
	"reflect"
	"testing"

	"github.com/wavetermdev/waveterm/pkg/waveobj"
)

func TestSortWorkspacesByDisplayOrder(t *testing.T) {
	workspaces := []*waveobj.Workspace{
		{OID: "unordered-a"},
		{OID: "third", Meta: waveobj.MetaMapType{waveobj.MetaKey_DisplayOrder: float64(3)}},
		{OID: "first", Meta: waveobj.MetaMapType{waveobj.MetaKey_DisplayOrder: float64(1)}},
		{OID: "unordered-b"},
		{OID: "second", Meta: waveobj.MetaMapType{waveobj.MetaKey_DisplayOrder: float64(2)}},
	}

	sortWorkspacesByDisplayOrder(workspaces)

	orderedIds := make([]string, len(workspaces))
	for index, workspace := range workspaces {
		orderedIds[index] = workspace.OID
	}
	expectedIds := []string{"first", "second", "third", "unordered-a", "unordered-b"}
	if !reflect.DeepEqual(expectedIds, orderedIds) {
		t.Fatalf("unexpected workspace order: got %v, want %v", orderedIds, expectedIds)
	}
}
