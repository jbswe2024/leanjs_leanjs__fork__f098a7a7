import type {
  CreateAppConfig,
  CreateComposableApp,
  MountOptions,
  Cleanup,
  MountFunc,
} from "@leanjs/core";
import { createApp as createVueApp } from "vue";
import type { Component, App } from "vue";
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  START_LOCATION,
} from "vue-router";
import type {
  RouteRecordRaw,
  RouterScrollBehavior,
  parseQuery,
  stringifyQuery,
} from "vue-router";
import { _ as CoreUtils } from "@leanjs/core";

const { createMount, getDefaultPathname, dedupeSlash } = CoreUtils;

export { CreateAppConfig, MountOptions, Cleanup };

interface VueRouterConfig {
  routes?: RouteRecordRaw[];
  scrollBehavior?: RouterScrollBehavior;
  parseQuery?: typeof parseQuery;
  stringifyQuery?: typeof stringifyQuery;
  linkActiveClass?: string;
  linkExactActiveClass?: string;
}
interface CreateRemoteVueConfig extends CreateAppConfig {
  router?: VueRouterConfig;
}

export const createApp = (
  App: Component,
  {
    packageName,
    router: { routes = [], ...routerConfig } = {},
  }: CreateRemoteVueConfig
) => {
  const createComposableApp: CreateComposableApp = ({ isSelfHosted } = {}) => {
    const mount: MountFunc = (
      el,
      {
        runtime,
        onRemoteNavigate,
        basename,
        pathname = getDefaultPathname(isSelfHosted),
        initialState,
      } = {}
    ) => {
      let app: App;
      let semaphore = true;
      const history = isSelfHosted
        ? createWebHistory(basename)
        : createMemoryHistory(basename);

      history.replace(pathname);
      const router = createRouter({
        history,
        routes,
        ...routerConfig,
      });

      return {
        ...createMount({
          el,
          packageName,
          initialState,
          isSelfHosted,
          onError: runtime?.logError,
          cleanups: onRemoteNavigate
            ? [
                router.beforeEach((to, from) => {
                  if (from !== START_LOCATION) {
                    onRemoteNavigate?.({
                      pathname: [basename, to.path]
                        .join("/")
                        .replace(/\/{2,}/g, "/"),
                      hash: to.hash,
                      // TODO search: to.query,
                    });
                  }
                }),
              ]
            : [],
          render: ({ appProps, logScopedError }) => {
            try {
              app = createVueApp(App, { ...appProps, isSelfHosted })
                .provide("runtime", runtime)
                .use(router);
              app.mount(el);
            } catch (error) {
              logScopedError(error);
            }
          },
          unmount: () => {
            app?.unmount();
          },
        }),
        onHostNavigate: async ({ pathname: rawNextPathname }) => {
          const nextPathname = basename
            ? dedupeSlash(rawNextPathname.replace(basename, "/"))
            : rawNextPathname;

          if (semaphore && nextPathname !== history.location) {
            semaphore = false;
            // We need a semaphore here because VueRouter router.push is async.
            // router.push triggers an event in the router of the host because of onRemoteNavigate,
            // which triggers onHostNavigate again. However, history.location is not yet updated this second time because router.push is async.
            // That creates an infinite loop. This semaphore avoids such infinite loop.
            await router?.push(nextPathname);
            semaphore = true;
          }
        },
      };
    };

    return { mount, packageName };
  };

  createComposableApp.packageName = packageName;

  return createComposableApp;
};
