declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_CONFIG_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
