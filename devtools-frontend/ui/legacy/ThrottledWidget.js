// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as Common from '../../core/common/common.js';
import { VBox } from './Widget.js';
export class ThrottledWidget extends VBox {
    updateThrottler;
    updateWhenVisible;
    lastUpdatePromise = Promise.resolve();
    constructor(useShadowDom, timeout) {
        super(useShadowDom);
        this.updateThrottler = new Common.Throttler.Throttler(timeout === undefined ? 100 : timeout);
        this.updateWhenVisible = false;
    }
    doUpdate() {
        return Promise.resolve();
    }
    update() {
        this.updateWhenVisible = !this.isShowing();
        if (this.updateWhenVisible) {
            return;
        }
        this.lastUpdatePromise = this.updateThrottler.schedule(() => {
            if (this.isShowing()) {
                return this.doUpdate();
            }
            this.updateWhenVisible = true;
            return Promise.resolve();
        });
    }
    get updateComplete() {
        return this.updateThrottler.processCompleted?.then(result => Boolean(result)) || Promise.resolve(false);
    }
    wasShown() {
        super.wasShown();
        if (this.updateWhenVisible) {
            this.update();
        }
    }
}
//# sourceMappingURL=ThrottledWidget.js.map