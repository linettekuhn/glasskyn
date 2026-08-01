// Type augmentation for React Native 0.81.x + @types/react 19.x compatibility
// 
// React Native 0.81 uses a mixin pattern (Constructor<NativeMethods> & typeof XxxComponent)
// for its component classes. TypeScript's structural type system doesn't properly
// track that these classes extend React.Component, causing JSX errors like:
//   "'View' cannot be used as a JSX component."
//   "Type 'View' is missing the following properties from type 'Component': 
//    context, setState, forceUpdate, render, props, state"
//
// This file augments each affected component's instance type with the missing
// React.Component members via interface merging.

import "react-native";

declare module "react-native" {
  // --- Core Layout Components -------------------------------------------
  interface View {
    context: unknown;
    props: Readonly<ViewProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<ViewProps>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  interface Text {
    context: unknown;
    props: Readonly<TextProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<TextProps>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  interface Image {
    context: unknown;
    props: Readonly<ImageProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<ImageProps>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  interface ImageBackground {
    context: unknown;
    props: Readonly<ImageBackgroundProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<ImageBackgroundProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Activity Indicator ----------------------------------------------
  interface ActivityIndicator {
    context: unknown;
    props: Readonly<ActivityIndicatorProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<ActivityIndicatorProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Scrollable Components -------------------------------------------
  interface ScrollView {
    context: unknown;
    props: Readonly<ScrollViewProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<ScrollViewProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Text Input ------------------------------------------------------
  interface TextInput {
    context: unknown;
    props: Readonly<TextInputProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<TextInputProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
    // NativeMethods
    focus(): void;
    blur(): void;
    measure(
      callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void
    ): void;
    measureInWindow(
      callback: (x: number, y: number, width: number, height: number) => void
    ): void;
    measureLayout(
      relativeToNativeComponentRef: object | number,
      onSuccess: (x: number, y: number, width: number, height: number) => void,
      onFail?: () => void
    ): void;
    setNativeProps(nativeProps: object): void;
  }

  // --- Keyboard Avoiding View ------------------------------------------
  interface KeyboardAvoidingView {
    context: unknown;
    props: Readonly<KeyboardAvoidingViewProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<KeyboardAvoidingViewProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Safe Area View --------------------------------------------------
  interface SafeAreaView {
    context: unknown;
    props: Readonly<ViewProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<ViewProps>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Pressable -------------------------------------------------------
  interface Pressable {
    context: unknown;
    props: Readonly<PressableProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<PressableProps>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Touchables ------------------------------------------------------
  interface TouchableWithoutFeedback {
    context: unknown;
    props: Readonly<TouchableWithoutFeedbackProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<TouchableWithoutFeedbackProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  interface TouchableOpacity {
    context: unknown;
    props: Readonly<TouchableOpacityProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<TouchableOpacityProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  interface TouchableHighlight {
    context: unknown;
    props: Readonly<TouchableHighlightProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<TouchableHighlightProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  interface TouchableNativeFeedback {
    context: unknown;
    props: Readonly<TouchableNativeFeedbackProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<TouchableNativeFeedbackProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Refresh Control -------------------------------------------------
  interface RefreshControl {
    context: unknown;
    props: Readonly<RefreshControlProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<RefreshControlProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Switch ----------------------------------------------------------
  interface Switch {
    context: unknown;
    props: Readonly<SwitchProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<SwitchProps>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Modal -----------------------------------------------------------
  interface Modal {
    context: unknown;
    props: Readonly<ModalProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<ModalProps>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- StatusBar -------------------------------------------------------
  interface StatusBar {
    context: unknown;
    props: Readonly<StatusBarProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<StatusBarProps>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- Android-Specific ------------------------------------------------
  interface DrawerLayoutAndroid {
    context: unknown;
    props: Readonly<DrawerLayoutAndroidProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<DrawerLayoutAndroidProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  interface ProgressBarAndroid {
    context: unknown;
    props: Readonly<ProgressBarAndroidProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<ProgressBarAndroidProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- InputAccessoryView ----------------------------------------------
  interface InputAccessoryView {
    context: unknown;
    props: Readonly<InputAccessoryViewProps>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((
            prevState: Readonly<{}>,
            props: Readonly<InputAccessoryViewProps>
          ) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- FlatList --------------------------------------------------------
  interface FlatList<ItemT = any> {
    context: unknown;
    props: Readonly<FlatListProps<ItemT>>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<FlatListProps<ItemT>>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- SectionList -----------------------------------------------------
  interface SectionList<ItemT = any, SectionT = any> {
    context: unknown;
    props: Readonly<SectionListProps<ItemT, SectionT>>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<SectionListProps<ItemT, SectionT>>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }

  // --- VirtualizedList -------------------------------------------------
  interface VirtualizedList<ItemT = any> {
    context: unknown;
    props: Readonly<VirtualizedListProps<ItemT>>;
    state: Readonly<{}>;
    setState<K extends keyof any>(
      state:
        | ((prevState: Readonly<{}>, props: Readonly<VirtualizedListProps<ItemT>>) => any)
        | any,
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): import("react").ReactNode;
  }
}
