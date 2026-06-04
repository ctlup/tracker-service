declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_BASE?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
