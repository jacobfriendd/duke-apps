export {};

declare global {
  interface Window {
    __INFORMER__?: {
      openChat: (opts: {
        prompt?: string;
        context?: Record<string, unknown>;
        instructions?: string;
        skills?: string[];
      }) => void;
      registerTool: (def: {
        name: string;
        description: string;
        schema: object;
        handler: (args: any) => any;
      }) => void;
    };
  }
}
