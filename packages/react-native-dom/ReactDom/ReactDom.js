/** @flow */

import "pepjs";
import "@webcomponents/webcomponentsjs/bundles/webcomponents-sd-ce";
import "web-animations-js/web-animations-next.min";

import Yoga from "yoga-dom";

import type { Size } from "InternalLib";
import RCTRootView from "RCTRootView";
import bundleFromRoot from "BundleFromRoot";
import type { NativeModuleImports } from "RCTModule";
import type RCTUIManager from "RCTUIManager";
import RCTBridge from "RCTBridge";
import UIView from "UIView";
import NotificationCenter from "NotificationCenter";
import RCTDeviceInfo from "RCTDeviceInfo";
import RCTTiming from "RCTTiming";
import RCTView from "RCTView";
import instrument from "Instrument";
import RCTModule from "RCTModule";
import RCTViewManager from "RCTViewManager";
import RCTEventEmitter from "RCTNativeEventEmitter";
import RCTEventDispatcher, { type RCTEvent } from "RCTEventDispatcher";
import { DIRECTION_CHANGE_EVENT } from "RCTI18nManager";
import RCTTouchHandler from "RCTTouchHandler";
import type RCTI18nManager from "RCTI18nManager";

declare var __DEV__: boolean;

global.process = global.process || {};
global.process.env = global.process.env || {};
if (!global.process.env.NODE_ENV) {
  global.process.env.NODE_ENV = __DEV__ ? "development" : "production";
}

// Export native modules to provide ability for others to provide their own modules
export {
  RCTView,
  RCTViewManager,
  RCTEventEmitter,
  UIView,
  RCTRootView,
  RCTModule
};

// Export type definitions useful for native module development
export type { RCTEventDispatcher, RCTBridge, RCTEvent, RCTUIManager };

// Register Built-in Native Modules
const builtInNativeModules: any[] = [
  require("RCTHistory"),
  require("RCTSourceCode"),
  require("RCTEventDispatcher"),
  require("RCTDeviceInfo"),
  require("RCTPlatform"),
  require("RCTTiming"),
  require("RCTUIManager"),
  require("RCTViewManager"),
  require("RCTTextManager"),
  require("RCTRawTextManager"),
  require("RCTScrollViewManager"),
  require("RCTScrollContentViewManager"),
  require("RCTNativeAnimatedModule"),
  require("RCTAsyncLocalStorage"),
  require("RCTImageViewManager"),
  require("RCTLinkingManager"),
  require("RCTTextInputManager"),
  require("RCTImageLoader"),
  require("RCTActivityIndicatorViewManager"),
  require("RCTWebSocketModule"),
  require("RCTAppState"),
  require("RCTSafeAreaViewManager"),
  require("RCTSwitchManager"),
  require("RCTStatusBarManager"),
  require("RCTDeviceEventManager"),
  require("RCTKeyboardObserver"),
  require("RCTExceptionsManager"),
  require("RCTRedBox"),
  require("RCTWebViewManager"),
  require("RCTNetworkingNative"),
  require("RCTBlobManager"),
  require("RCTVibration"),
  require("RCTI18nManager")
];

// Development Specific Native Modules
if (__DEV__) {
  builtInNativeModules.push(require("RCTDevLoadingView"));
  builtInNativeModules.push(require("RCTDevSettings"));
  builtInNativeModules.push(require("RCTDevMenu"));
}

type RNDomInstanceOptions = {
  enableHotReload?: boolean,
  nativeModules?: any[],
  bundleFromRoot?: boolean,
  urlScheme?: string,
  basename?: string,
  initialProps?: any
};

// React Native Web Entrypoint instance
export class RNDomInstance {
  rootView: RCTRootView;

  bridge: RCTBridge;
  uiManager: *;
  timing: RCTTiming;
  ticking: boolean;
  availableSize: Size;
  bundleLocation: string;
  enableHotReload: boolean;

  touchHandler: RCTTouchHandler;

  initialization: Promise<void>;
  initialProps: void | any;

  constructor(
    bundle: string,
    moduleName: string,
    parent: HTMLElement,
    options: RNDomInstanceOptions = {}
  ) {
    const enableHotReload = options.enableHotReload ?? false;
    const userNativeModules = options.nativeModules ?? [];
    const shouldBundleFromRoot = options.bundleFromRoot ?? true;
    const urlScheme = options.urlScheme ?? moduleName.toLowerCase();
    const basename = options.basename ?? "";

    this.initialProps = options.initialProps;
    this.bundleLocation = bundle;
    this.enableHotReload = enableHotReload;

    bundle = shouldBundleFromRoot ? bundleFromRoot(bundle) : bundle;
    if (this.enableHotReload) {
      bundle += "&hot=true";
    }

    this.bridge = new RCTBridge(
      moduleName,
      bundle,
      (builtInNativeModules.concat(userNativeModules): NativeModuleImports),
      parent,
      urlScheme,
      basename
    );

    this.rootView = new RCTRootView(this, moduleName, parent, this.bridge);

    this.initialization = this.initializeBridge(this.bridge);
  }

  async initializeBridge(bridge: RCTBridge) {
    this.bridge = bridge;
    this.bridge.bundleFinishedLoading = this.bundleFinishedLoading.bind(this);

    const yoga = await Yoga;
    this.bridge.Yoga = yoga;
    await this.bridge.initializeModules();

    const deviceInfoModule: RCTDeviceInfo = (this.bridge.modulesByName[
      "DeviceInfo"
    ]: any);

    const dimensions = deviceInfoModule.exportedDimensions().window;
    this.availableSize = {
      width: dimensions.width,
      height: dimensions.height
    };
    this.rootView.availableSize = this.availableSize;
    this.rootView.width = this.availableSize.width;
    this.rootView.height = this.availableSize.height;

    this.uiManager = this.bridge.uiManager;
    this.timing = (this.bridge.modulesByName["Timing"]: any);

    this.touchHandler = new RCTTouchHandler(this.bridge);
    this.touchHandler.attachToView(this.rootView);

    this.ticking = false;

    const i18nModule: RCTI18nManager = (this.bridge.modulesByName[
      "I18nManager"
    ]: any);

    this.rootView.direction = i18nModule.direction;

    NotificationCenter.addListener(DIRECTION_CHANGE_EVENT, ({ direction }) => {
      this.rootView.direction = direction;
    });
  }

  requestTick = () => {
    if (!this.ticking) {
      window.requestAnimationFrame(this.renderLoop.bind(this));
    }
    this.ticking = true;
  };

  async renderLoop() {
    this.ticking = false;

    const frameStart = window.performance ? performance.now() : Date.now();

    await instrument("⚛️ Timing", () => this.timing.frame());
    await instrument("⚛️ Bridge", () => this.bridge.frame());
    await instrument("⚛️ Rendering", () => this.uiManager.frame());

    await this.timing.idle(frameStart);

    if (
      this.timing.shouldContinue() ||
      this.bridge.shouldContinue() ||
      this.uiManager.shouldContinue()
    ) {
      this.requestTick();
    } else {
      // Only ocasionally check for updates from the react thread
      // (this is just a sanity check and shouldn't really be necessary)
      window.setTimeout(this.requestTick, 1000);
    }
  }

  bundleFinishedLoading() {
    this.rootView.runApplication(this.initialProps);

    if (__DEV__ && this.enableHotReload) {
      const bundleURL = new URL(this.bundleLocation);
      console.warn("HotReload on " + this.bundleLocation);
      this.bridge.enqueueJSCall("HMRClient", "enable", [
        "dom",
        bundleURL.pathname.toString().substr(1),
        bundleURL.hostname,
        bundleURL.port
      ]);
    }
  }

  async start() {
    await this.initialization;
    this.rootView.render();

    this.bridge.loadBridgeConfig();
    this.requestTick();
  }
}
