/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import {
  EuiCheckbox,
  EuiButtonIcon,
  EuiPopover,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPopoverTitle,
  EuiSpacer,
  EuiDataGridControlColumn,
} from '@elastic/eui';
import { RowControlColumn } from '@kbn/discover-utils';

const SelectionHeaderCell = () => {
  return (
    <div data-test-subj="test-header-control-column-cell">
      <EuiCheckbox id="selection-toggle" aria-label="Select all rows" onChange={() => null} />
    </div>
  );
};

const SimpleHeaderCell = () => {
  return (
    <div
      style={{
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: 1.5,
        minWidth: 0,
        padding: '4px',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
      data-test-subj="test-header-action-cell"
    >
      {'Additional Actions'}
    </div>
  );
};

const SelectionRowCell = ({ rowIndex }: { rowIndex: number }) => {
  return (
    <div data-test-subj="test-body-control-column-cell">
      <EuiCheckbox
        id={`${rowIndex}`}
        aria-label={`Select row test`}
        checked={false}
        onChange={() => null}
      />
    </div>
  );
};

const TestTrailingColumn = () => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  return (
    <EuiPopover
      isOpen={isPopoverOpen}
      anchorPosition="upCenter"
      panelPaddingSize="s"
      button={
        <EuiButtonIcon
          aria-label="show actions"
          iconType="boxesHorizontal"
          color="text"
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
        />
      }
      data-test-subj="test-trailing-column-popover-button"
      closePopover={() => setIsPopoverOpen(false)}
    >
      <EuiPopoverTitle>{'Actions'}</EuiPopoverTitle>
      <div style={{ width: 150 }}>
        <button type="button" onClick={() => {}}>
          <EuiFlexGroup alignItems="center" component="span" gutterSize="s">
            <EuiFlexItem grow={false}>
              <EuiButtonIcon aria-label="Pin selected items" iconType="pin" color="text" />
            </EuiFlexItem>
            <EuiFlexItem>{'Pin'}</EuiFlexItem>
          </EuiFlexGroup>
        </button>
        <EuiSpacer size="s" />
        <button type="button" onClick={() => {}}>
          <EuiFlexGroup alignItems="center" component="span" gutterSize="s">
            <EuiFlexItem grow={false}>
              <EuiButtonIcon aria-label="Delete selected items" iconType="trash" color="text" />
            </EuiFlexItem>
            <EuiFlexItem>{'Delete'}</EuiFlexItem>
          </EuiFlexGroup>
        </button>
      </div>
    </EuiPopover>
  );
};

export const testTrailingControlColumns = [
  {
    id: 'actions',
    width: 96,
    headerCellRender: SimpleHeaderCell,
    rowCellRender: TestTrailingColumn,
  },
];

export const testLeadingControlColumn: EuiDataGridControlColumn = {
  id: 'test-leading-control',
  headerCellRender: SelectionHeaderCell,
  rowCellRender: SelectionRowCell,
  width: 100,
};

export const mockRowAdditionalLeadingControls = ['visBarVerticalStacked', 'heart', 'inspect'].map(
  (iconType): RowControlColumn => ({
    id: `exampleRowControl-${iconType}`,
    render: (Control, rowProps) => {
      return (
        <Control
          data-test-subj={`exampleRowControl-${iconType}`}
          label={`Example ${iconType}`}
          tooltipContent={`Example ${iconType}`}
          iconType={iconType}
          onClick={() => {
            alert(`Example "${iconType}" control clicked. Row index: ${rowProps.rowIndex}`);
          }}
        />
      );
    },
  })
);
