/** @flow */

import Yoga from "yoga-dom";

import type { Size } from "InternalLib";
import RCTBridge from "RCTBridge";
import UIView from "UIView";
import NotificationCenter from "NotificationCenter";
import RCTDeviceInfo from "RCTDeviceInfo";
import RCTTiming from "RCTTiming";
import RCTTouchHandler from "RCTTouchHandler";
import instrument from "Instrument";
import type { Frame } from "InternalLib";
import { DIRECTION_CHANGE_EVENT } from "RCTI18nManager";
import type { NativeModuleImports } from "RCTModule";
import { RNDomInstance } from "ReactDom";

declare var __DEV__: boolean;

class RCTRootView extends UIView {
  _reactTag: number;

  domInstance: RNDomInstance;
  bridge: RCTBridge;
  moduleName: string;
  availableSize: Size;
  parent: HTMLElement;

  constructor(
    domInstance: RNDomInstance,
    moduleName: string,
    parent: HTMLElement,
    bridge: RCTBridge
  ) {
    super();

    this.domInstance = domInstance;
    this.moduleName = moduleName;
    this.parent = parent;

    this.updateHostStyle("touchAction", "none");
    this.setAttribute("touch-action", "none");
    this.bridge = bridge;
  }

  get reactTag(): number {
    if (!this._reactTag) {
      const reactTag = this.bridge.uiManager.allocateRootTag;
      super.reactTag = reactTag;
      this.bridge.uiManager.registerRootView(this);
    }
    return this._reactTag;
  }

  set reactTag(value: number) {}

  runApplication(initialProps?: any = {}) {
    const appParameters = {
      rootTag: this.reactTag,
      initialProps
    };

    this.bridge.enqueueJSCall("AppRegistry", "runApplication", [
      this.moduleName,
      appParameters
    ]);
  }

  requestTick = () => {
    this.domInstance.requestTick();
  };

  async render() {
    this.updateHostStyle({
      WebkitTapHighlightColor: "transparent",
      userSelect: "none",
      overflow: "hidden",
      position: "absolute"
    });

    this.parent.appendChild(this);
    this.requestTick();
  }
}

customElements.define("rct-root-view", RCTRootView);

export default RCTRootView;
