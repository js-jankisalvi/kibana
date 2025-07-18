/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { render } from '@testing-library/react';
import { MountWrapper, mountReactNode } from './mount';

describe('MountWrapper', () => {
  it('renders an html element in react tree', () => {
    const mountPoint = (container: HTMLElement) => {
      const el = document.createElement('p');
      el.textContent = 'hello';
      el.className = 'bar';
      container.append(el);
      return () => {};
    };
    const wrapper = <MountWrapper mount={mountPoint} />;
    const container = render(wrapper);
    expect(container.container.innerHTML).toMatchInlineSnapshot(
      `"<div class=\\"kbnMountWrapper\\"><p class=\\"bar\\">hello</p></div>"`
    );
  });

  it('updates the react tree when the mounted element changes', () => {
    const el = document.createElement('p');
    el.textContent = 'initial';

    const mountPoint = (container: HTMLElement) => {
      container.append(el);
      return () => {};
    };

    const wrapper = <MountWrapper mount={mountPoint} />;
    const container = render(wrapper);
    expect(container.container.innerHTML).toMatchInlineSnapshot(
      `"<div class=\\"kbnMountWrapper\\"><p>initial</p></div>"`
    );

    el.textContent = 'changed';
    expect(container.container.innerHTML).toMatchInlineSnapshot(
      `"<div class=\\"kbnMountWrapper\\"><p>changed</p></div>"`
    );
  });

  it('can render a detached react component', () => {
    const mountPoint = mountReactNode(<span>detached</span>);
    const wrapper = <MountWrapper mount={mountPoint} />;
    const container = render(wrapper);
    expect(container.container.innerHTML).toMatchInlineSnapshot(
      `"<div class=\\"kbnMountWrapper\\"><span>detached</span></div>"`
    );
  });

  it('accepts a className prop to override default className', () => {
    const mountPoint = mountReactNode(<span>detached</span>);
    const wrapper = <MountWrapper mount={mountPoint} className="customClass" />;
    const container = render(wrapper);
    expect(container.container.innerHTML).toMatchInlineSnapshot(
      `"<div class=\\"customClass\\"><span>detached</span></div>"`
    );
  });
});
