import { createRuntimeBindings } from "@leanjs/react/18";
import { configureRuntime, GetRuntime } from "@leanjs/core";
import { Application } from "@art-boards/ui-canvas";

const defaultState = {};

export const { createRuntime } = configureRuntime(defaultState)({
  onError: (error) => console.log(`🚨 log this error properly 🔥`, error),
  apiFactory: {
    canvas: ({ onCleanup }) => {
      const app = new Application({
        antialias: true,
        backgroundColor: 0x202124,
        width: window.innerWidth * 0.7,
        height: Math.max(
          document.documentElement.clientHeight || 0,
          window.innerHeight || 0
        ),
      });

      onCleanup(() => {
        app.destroy();
      });

      return app;
    },
  },
});

export type Runtime = GetRuntime<typeof createRuntime>;

export const {
  useGetter,
  useSetter,
  useLoading,
  useError,
  useRuntime,
  HostProvider,
} = createRuntimeBindings(createRuntime);
