/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Reference } from '@kbn/content-management-utils';
import { ControlGroupApi, ControlGroupSerializedState } from '@kbn/controls-plugin/public';
import { SearchSessionInfoProvider } from '@kbn/data-plugin/public';
import type { DefaultEmbeddableApi, EmbeddablePackageState } from '@kbn/embeddable-plugin/public';
import { Filter, Query, TimeRange } from '@kbn/es-query';
import { PublishesESQLVariables } from '@kbn/esql-types';
import { IKbnUrlStateStorage } from '@kbn/kibana-utils-plugin/public';
import {
  CanExpandPanels,
  HasRuntimeChildState,
  HasSaveNotification,
  HasSerializedChildState,
  PresentationContainer,
  PublishesSettings,
  TrackContentfulRender,
  TracksOverlays,
} from '@kbn/presentation-containers';
import {
  SerializedPanelState,
  EmbeddableAppContext,
  HasAppContext,
  HasExecutionContext,
  HasType,
  HasUniqueId,
  PublishesDataLoading,
  PublishesDataViews,
  PublishesDescription,
  PublishesTitle,
  PublishesSavedObjectId,
  PublishesUnifiedSearch,
  PublishesViewMode,
  PublishesWritableViewMode,
  PublishingSubject,
} from '@kbn/presentation-publishing';
import { PublishesReload } from '@kbn/presentation-publishing/interfaces/fetch/publishes_reload';
import { PublishesSearchSession } from '@kbn/presentation-publishing/interfaces/fetch/publishes_search_session';
import { LocatorPublic } from '@kbn/share-plugin/common';
import { Observable, Subject } from 'rxjs';
import {
  DashboardLocatorParams,
  DashboardPanelMap,
  DashboardPanelState,
  DashboardSettings,
  DashboardState,
} from '../../common';
import type { DashboardAttributes } from '../../server/content_management';
import {
  LoadDashboardReturn,
  SaveDashboardReturn,
} from '../services/dashboard_content_management_service/types';

export const DASHBOARD_API_TYPE = 'dashboard';

export interface DashboardCreationOptions {
  getInitialInput?: () => Partial<DashboardState>;

  getIncomingEmbeddable?: () => EmbeddablePackageState | undefined;

  useSearchSessionsIntegration?: boolean;
  searchSessionSettings?: {
    sessionIdToRestore?: string;
    sessionIdUrlChangeObservable?: Observable<string | undefined>;
    getSearchSessionIdFromURL: () => string | undefined;
    removeSessionIdFromUrl: () => void;
    createSessionRestorationDataProvider: (dashboardApi: DashboardApi) => SearchSessionInfoProvider;
  };

  useSessionStorageIntegration?: boolean;

  useUnifiedSearchIntegration?: boolean;
  unifiedSearchSettings?: { kbnUrlStateStorage: IKbnUrlStateStorage };

  validateLoadedSavedObject?: (result: LoadDashboardReturn) => 'valid' | 'invalid' | 'redirected';

  fullScreenMode?: boolean;
  isEmbeddedExternally?: boolean;

  getEmbeddableAppContext?: (dashboardId?: string) => EmbeddableAppContext;
}

export interface UnsavedPanelState {
  [key: string]: object | undefined;
}

export type DashboardApi = CanExpandPanels &
  HasAppContext &
  HasExecutionContext &
  HasRuntimeChildState &
  HasSaveNotification &
  HasSerializedChildState &
  HasType<typeof DASHBOARD_API_TYPE> &
  HasUniqueId &
  PresentationContainer &
  PublishesDataLoading &
  PublishesDataViews &
  PublishesDescription &
  Pick<PublishesTitle, 'title$'> &
  PublishesReload &
  PublishesSavedObjectId &
  PublishesESQLVariables &
  PublishesSearchSession &
  PublishesSettings &
  PublishesUnifiedSearch &
  PublishesViewMode &
  PublishesWritableViewMode &
  TrackContentfulRender &
  TracksOverlays & {
    asyncResetToLastSavedState: () => Promise<void>;
    controlGroupApi$: PublishingSubject<ControlGroupApi | undefined>;
    fullScreenMode$: PublishingSubject<boolean>;
    focusedPanelId$: PublishingSubject<string | undefined>;
    setFocusedPanelId: (id: string | undefined) => void;
    forceRefresh: () => void;
    getSettings: () => DashboardSettings;
    getSerializedState: () => {
      attributes: DashboardAttributes;
      references: Reference[];
    };
    getDashboardPanelFromId: (id: string) => DashboardPanelState;
    hasOverlays$: PublishingSubject<boolean>;
    hasUnsavedChanges$: PublishingSubject<boolean>;
    highlightPanel: (panelRef: HTMLDivElement) => void;
    highlightPanelId$: PublishingSubject<string | undefined>;
    isEmbeddedExternally: boolean;
    isManaged: boolean;
    locator?: Pick<LocatorPublic<DashboardLocatorParams>, 'navigate' | 'getRedirectUrl'>;
    panels$: PublishingSubject<DashboardPanelMap>;
    runInteractiveSave: () => Promise<SaveDashboardReturn | undefined>;
    runQuickSave: () => Promise<void>;
    scrollToPanel: (panelRef: HTMLDivElement) => void;
    scrollToPanelId$: PublishingSubject<string | undefined>;
    scrollToTop: () => void;
    setFilters: (filters?: Filter[] | undefined) => void;
    setFullScreenMode: (fullScreenMode: boolean) => void;
    setHighlightPanelId: (id: string | undefined) => void;
    setPanels: (panels: DashboardPanelMap) => void;
    setQuery: (query?: Query | undefined) => void;
    setScrollToPanelId: (id: string | undefined) => void;
    setSettings: (settings: DashboardSettings) => void;
    setTags: (tags: string[]) => void;
    setTimeRange: (timeRange?: TimeRange | undefined) => void;
    unifiedSearchFilters$: PublishesUnifiedSearch['filters$'];
    untilEmbeddableLoaded: (id: string) => Promise<unknown | undefined>;
  };

export interface DashboardInternalApi {
  controlGroupReload$: Subject<void>;
  panelsReload$: Subject<void>;
  getRuntimeStateForControlGroup: () => object | undefined;
  getSerializedStateForControlGroup: () => SerializedPanelState<ControlGroupSerializedState>;
  registerChildApi: (api: DefaultEmbeddableApi) => void;
  setControlGroupApi: (controlGroupApi: ControlGroupApi) => void;
}
