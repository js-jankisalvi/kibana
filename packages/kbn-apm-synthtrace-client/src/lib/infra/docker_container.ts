/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/* eslint-disable max-classes-per-file */
import { Entity, Fields } from '../entity';
import { Serializable } from '../serializable';

interface DockerContainerDocument extends Fields {
  'container.id': string;
  'metricset.name'?: string;
  'container.name'?: string;
  'container.image.name'?: string;
  'container.runtime'?: string;
  'host.name'?: string;
  'cloud.provider'?: string;
  'cloud.instance.id'?: string;
  'cloud.image.id'?: string;
  'event.dataset'?: string;
}

export class DockerContainer extends Entity<DockerContainerDocument> {
  metrics() {
    return new DockerContainerMetrics({
      ...this.fields,
      'docker.cpu.total.pct': 0.25,
      'docker.memory.usage.pct': 0.2,
      'docker.network.inbound.bytes': 100,
      'docker.network.outbound.bytes': 200,
      'docker.diskio.read.ops': 10,
      'docker.diskio.write.ops': 20,
    });
  }
}

export interface DockerContainerMetricsDocument extends DockerContainerDocument {
  'docker.cpu.total.pct': number;
  'docker.memory.usage.pct': number;
  'docker.network.inbound.bytes': number;
  'docker.network.outbound.bytes': number;
  'docker.diskio.read.ops': number;
  'docker.diskio.write.ops': number;
}

class DockerContainerMetrics extends Serializable<DockerContainerMetricsDocument> {}

export function dockerContainer(id: string): DockerContainer {
  return new DockerContainer({
    'container.id': id,
    'container.name': `container-${id}`,
    'container.runtime': 'docker',
    'container.image.name': 'image-1',
    'host.name': 'host-1',
    'cloud.instance.id': 'instance-1',
    'cloud.image.id': 'image-1',
    'cloud.provider': 'aws',
    'event.dataset': 'docker.container',
  });
}
