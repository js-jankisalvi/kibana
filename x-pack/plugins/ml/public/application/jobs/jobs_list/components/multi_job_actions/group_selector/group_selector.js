/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { withKibana } from '@kbn/kibana-react-plugin/public';

import {
  EuiButton,
  EuiToolTip,
  EuiPopover,
  EuiPopoverTitle,
  EuiButtonIcon,
  EuiHorizontalRule,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
} from '@elastic/eui';

import { cloneDeep } from 'lodash';

import { checkPermission } from '../../../../../capabilities/check_capabilities';
import { GroupList } from './group_list';
import { NewGroupInput } from './new_group_input';
import { toastNotificationServiceProvider } from '../../../../../services/toast_notification_service';

function createSelectedGroups(jobs, groups) {
  const jobIds = jobs.map((j) => j.id);
  const groupCounts = {};
  jobs.forEach((j) => {
    j.groups.forEach((g) => {
      if (groupCounts[g] === undefined) {
        groupCounts[g] = 0;
      }
      groupCounts[g]++;
    });
  });

  const selectedGroups = groups.reduce((p, c) => {
    if (c.jobIds.some((j) => jobIds.includes(j))) {
      p[c.id] = {
        partial: groupCounts[c.id] !== jobIds.length,
      };
    }
    return p;
  }, {});

  return selectedGroups;
}

export class GroupSelectorUI extends Component {
  static propTypes = {
    jobs: PropTypes.array.isRequired,
    allJobIds: PropTypes.array.isRequired,
    refreshJobs: PropTypes.func.isRequired,
  };

  constructor(props, constructorContext) {
    super(props, constructorContext);

    this.state = {
      isPopoverOpen: false,
      groups: [],
      selectedGroups: {},
      edited: false,
    };

    this.refreshJobs = this.props.refreshJobs;
    this.canUpdateJob = checkPermission('canUpdateJob');
    this.toastNotificationsService = toastNotificationServiceProvider(
      props.kibana.services.notifications.toasts
    );
  }

  static getDerivedStateFromProps(props, state) {
    if (state.edited === false) {
      const selectedGroups = createSelectedGroups(props.jobs, state.groups);
      return { selectedGroups };
    } else {
      return {};
    }
  }

  togglePopover = () => {
    if (this.state.isPopoverOpen) {
      this.closePopover();
    } else {
      const mlApi = this.props.kibana.services.mlServices.mlApi;
      mlApi.jobs
        .groups()
        .then((groups) => {
          const selectedGroups = createSelectedGroups(this.props.jobs, groups);

          this.setState({
            isPopoverOpen: true,
            edited: false,
            selectedGroups,
            groups,
          });
        })
        .catch((error) => {
          console.error(error);
        });
    }
  };

  closePopover = () => {
    this.setState({
      edited: false,
      isPopoverOpen: false,
    });
  };

  selectGroup = (group) => {
    const newSelectedGroups = cloneDeep(this.state.selectedGroups);

    if (newSelectedGroups[group.id] === undefined) {
      newSelectedGroups[group.id] = {
        partial: false,
      };
    } else if (newSelectedGroups[group.id].partial === true) {
      newSelectedGroups[group.id].partial = false;
    } else {
      delete newSelectedGroups[group.id];
    }

    this.setState({
      selectedGroups: newSelectedGroups,
      edited: true,
    });
  };

  applyChanges = () => {
    const toastNotificationsService = this.toastNotificationsService;
    const { selectedGroups } = this.state;
    const { jobs } = this.props;
    const newJobs = jobs.map((j) => ({
      id: j.id,
      oldGroups: j.groups,
      newGroups: [],
    }));

    for (const gId in selectedGroups) {
      if (Object.hasOwn(selectedGroups, gId)) {
        const group = selectedGroups[gId];
        newJobs.forEach((j) => {
          if (group.partial === false || (group.partial === true && j.oldGroups.includes(gId))) {
            j.newGroups.push(gId);
          }
        });
      }
    }

    const tempJobs = newJobs.map((j) => ({ jobId: j.id, groups: j.newGroups }));
    const mlApi = this.props.kibana.services.mlServices.mlApi;
    mlApi.jobs
      .updateGroups(tempJobs)
      .then((resp) => {
        let success = true;
        for (const jobId in resp) {
          // check success of each job update
          if (Object.hasOwn(resp, jobId)) {
            if (resp[jobId].success === false) {
              toastNotificationsService.displayErrorToast(resp[jobId].error);
              success = false;
            }
          }
        }

        if (success) {
          // if all are successful refresh the job list
          this.refreshJobs();
          this.closePopover();
        } else {
          console.error(resp);
        }
      })
      .catch((error) => {
        toastNotificationsService.displayErrorToast(error);
        console.error(error);
      });
  };

  addNewGroup = (id) => {
    const newGroup = {
      id,
      calendarIds: [],
      jobIds: [],
    };

    const groups = this.state.groups;
    if (groups.some((g) => g.id === newGroup.id) === false) {
      groups.push(newGroup);
    }

    this.setState({
      groups,
    });
  };

  render() {
    const { groups, selectedGroups, edited } = this.state;
    const button = (
      <EuiToolTip
        position="bottom"
        content={
          <FormattedMessage
            id="xpack.ml.jobsList.multiJobActions.groupSelector.editJobGroupsButtonTooltip"
            defaultMessage="Edit job groups"
          />
        }
      >
        <EuiButtonIcon
          iconType="indexEdit"
          aria-label={i18n.translate(
            'xpack.ml.jobsList.multiJobActions.groupSelector.editJobGroupsButtonAriaLabel',
            {
              defaultMessage: 'Edit job groups',
            }
          )}
          onClick={() => this.togglePopover()}
          disabled={this.canUpdateJob === false}
          data-test-subj="mlADJobListMultiSelectEditJobGroupsButton"
        />
      </EuiToolTip>
    );

    return (
      <EuiPopover
        id="trapFocus"
        ownFocus
        button={button}
        isOpen={this.state.isPopoverOpen}
        closePopover={() => this.closePopover()}
      >
        <div>
          <EuiPopoverTitle>
            <FormattedMessage
              id="xpack.ml.jobsList.multiJobActions.groupSelector.applyGroupsToJobTitle"
              defaultMessage="Apply groups to {jobsCount, plural, one {job} other {jobs}}"
              values={{ jobsCount: this.props.jobs.length }}
            />
          </EuiPopoverTitle>

          <GroupList
            groups={groups}
            selectedGroups={selectedGroups}
            selectGroup={this.selectGroup}
          />

          <EuiHorizontalRule margin="xs" />
          <EuiSpacer size="s" />

          <NewGroupInput addNewGroup={this.addNewGroup} allJobIds={this.props.allJobIds} />

          <EuiHorizontalRule margin="m" />
          <div>
            <EuiFlexGroup>
              <EuiFlexItem grow={false}>
                <EuiButton size="s" onClick={this.applyChanges} isDisabled={edited === false}>
                  <FormattedMessage
                    id="xpack.ml.jobsList.multiJobActions.groupSelector.applyButtonLabel"
                    defaultMessage="Apply"
                  />
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </div>
        </div>
      </EuiPopover>
    );
  }
}

export const GroupSelector = withKibana(GroupSelectorUI);
