/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as TaskEither from 'fp-ts/TaskEither';
import type { SavedObjectsRawDoc } from '@kbn/core-saved-objects-server';
import type { TransformRawDocs } from '../types';
import type { DocumentsTransformFailed, DocumentsTransformSuccess } from '../core/migrate_raw_docs';

/** @internal */
export interface TransformDocsParams {
  transformRawDocs: TransformRawDocs;
  outdatedDocuments: SavedObjectsRawDoc[];
}
/*
 * Transform outdated docs
 * */
export const transformDocs = ({
  transformRawDocs,
  outdatedDocuments,
}: TransformDocsParams): TaskEither.TaskEither<
  DocumentsTransformFailed,
  DocumentsTransformSuccess
> => transformRawDocs(outdatedDocuments);
