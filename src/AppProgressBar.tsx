import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { NProgress } from 'nprogress-v2';
import { isSameURL, isSameURLWithoutSearch } from './utils/sameURL';
import {
  usePathname,
  useSearchParams,
  useRouter as useNextRouter,
} from 'next/navigation';
import type { AppProgressBarProps, RouterNProgressOptions } from '.';
import { getAnchorProperty } from './utils/getAnchorProperty';
import {
  type AppRouterInstance,
  NavigateOptions,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { css } from './utils/css';

type PushStateInput = [
  data: any,
  unused: string,
  url?: string | URL | null | undefined,
];

export const AppProgressBar = React.memo(
  ({
    color = '#0A2FFF',
    height = '2px',
    options,
    spinnerPosition = 'top-right',
    shallowRouting = false,
    disableSameURL = true,
    startPosition = 0,
    delay = 0,
    stopDelay = 0,
    style,
    disableStyle = false,
    nonce,
    targetPreprocessor,
    disableAnchorClick = false,
    startOnLoad = false,
  }: AppProgressBarProps) => {
    const styles = (
      <style nonce={nonce}>
        {style ||
          css({
            color,
            height,
            spinnerPosition,
          })}
      </style>
    );

    NProgress.configure(options || {});

    let progressDoneTimer: NodeJS.Timeout;

    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
      if (startOnLoad) NProgress.start();
      if (progressDoneTimer) clearTimeout(progressDoneTimer);
      progressDoneTimer = setTimeout(() => {
        NProgress.done();
      }, stopDelay);
    }, [pathname, searchParams]);

    const elementsWithAttachedHandlers = useRef<
      (HTMLAnchorElement | SVGAElement)[]
    >([]);
    useEffect(() => {
      if (disableAnchorClick) {
        return;
      }

      let timer: NodeJS.Timeout;

      const startProgress = () => {
        timer = setTimeout(() => {
          if (startPosition > 0) NProgress.set(startPosition);
          NProgress.start();
        }, delay);
      };

      const stopProgress = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          if (!NProgress.isStarted()) return;
          NProgress.done();
        }, stopDelay);
      };

      const handleAnchorClick = (event: MouseEvent) => {
        // Skip preventDefault
        if (event.defaultPrevented) return;

        const anchorElement = event.currentTarget as
          | HTMLAnchorElement
          | SVGAElement;
        const target = event.target as HTMLElement | Element;
        let preventProgress =
          target?.getAttribute('data-prevent-nprogress') === 'true' ||
          anchorElement?.getAttribute('data-prevent-nprogress') === 'true';

        if (!preventProgress) {
          let element: HTMLElement | Element | null = target;

          while (element && element.tagName.toLowerCase() !== 'a') {
            if (
              element.parentElement?.getAttribute('data-prevent-nprogress') ===
              'true'
            ) {
              preventProgress = true;
              break;
            }
            element = element.parentElement;
          }
        }

        if (preventProgress) return;

        const anchorTarget = getAnchorProperty(anchorElement, 'target');
        // Skip anchors with target="_blank"
        if (anchorTarget === '_blank') return;

        // Skip control/command/option/alt+click
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;

        const targetHref = getAnchorProperty(anchorElement, 'href');
        const targetUrl = targetPreprocessor
          ? targetPreprocessor(new URL(targetHref))
          : new URL(targetHref);
        const currentUrl = new URL(location.href);

        if (
          shallowRouting &&
          isSameURLWithoutSearch(targetUrl, currentUrl) &&
          disableSameURL
        )
          return;
        if (isSameURL(targetUrl, currentUrl) && disableSameURL) return;

        startProgress();
      };

      const handleMutation: MutationCallback = () => {
        const anchorElements = Array.from(document.querySelectorAll('a')) as (
          | HTMLAnchorElement
          | SVGAElement
        )[];

        const validAnchorElements = anchorElements.filter((anchor) => {
          const href = getAnchorProperty(anchor, 'href');
          const isNProgressDisabled =
            anchor.getAttribute('data-disable-nprogress') === 'true';
          const isNotTelOrMailto =
            href &&
            !href.startsWith('tel:') &&
            !href.startsWith('mailto:') &&
            !href.startsWith('blob:') &&
            !href.startsWith('javascript:');

          return (
            !isNProgressDisabled &&
            isNotTelOrMailto &&
            getAnchorProperty(anchor, 'target') !== '_blank'
          );
        });

        validAnchorElements.forEach((anchor) => {
          anchor.addEventListener('click', handleAnchorClick, true);
        });
        elementsWithAttachedHandlers.current = validAnchorElements;
      };

      const mutationObserver = new MutationObserver(handleMutation);
      mutationObserver.observe(document, { childList: true, subtree: true });

      const originalWindowHistoryPushState = window.history.pushState;
      window.history.pushState = new Proxy(window.history.pushState, {
        apply: (target, thisArg, argArray: PushStateInput) => {
          stopProgress();
          return target.apply(thisArg, argArray);
        },
      });

      return () => {
        mutationObserver.disconnect();
        elementsWithAttachedHandlers.current.forEach((anchor) => {
          anchor.removeEventListener('click', handleAnchorClick, true);
        });
        elementsWithAttachedHandlers.current = [];
        window.history.pushState = originalWindowHistoryPushState;
      };
    }, [
      disableAnchorClick,
      targetPreprocessor,
      shallowRouting,
      disableSameURL,
    ]);

    return !disableStyle ? styles : null;
  },
  (prevProps, nextProps) => {
    if (nextProps?.memo === false) {
      return false;
    }

    if (!nextProps?.shouldCompareComplexProps) {
      return true;
    }

    return (
      prevProps?.color === nextProps?.color &&
      prevProps?.height === nextProps?.height &&
      prevProps?.shallowRouting === nextProps?.shallowRouting &&
      prevProps?.startPosition === nextProps?.startPosition &&
      prevProps?.delay === nextProps?.delay &&
      prevProps?.disableSameURL === nextProps?.disableSameURL &&
      prevProps?.stopDelay === nextProps?.stopDelay &&
      prevProps?.nonce === nextProps?.nonce &&
      JSON.stringify(prevProps?.options) ===
        JSON.stringify(nextProps?.options) &&
      prevProps?.style === nextProps?.style &&
      prevProps.disableAnchorClick === nextProps.disableAnchorClick
    );
  },
);

AppProgressBar.displayName = 'AppProgressBar';

export function useRouter(customRouter?: () => AppRouterInstance) {
  const useSelectedRouter = useCallback(() => {
    if (customRouter) return customRouter();
    return useNextRouter();
  }, [customRouter]);

  const router = useSelectedRouter();

  const startProgress = useCallback(
    (startPosition?: number) => {
      if (startPosition && startPosition > 0) NProgress.set(startPosition);
      NProgress.start();
    },
    [router],
  );

  const stopProgress = useCallback(() => {
    if (!NProgress.isStarted()) return;
    NProgress.done();
  }, [router]);

  const progress = useCallback(
    (
      href: string,
      method: 'push' | 'replace',
      options?: NavigateOptions,
      NProgressOptions?: RouterNProgressOptions,
    ) => {
      if (NProgressOptions?.showProgressBar === false) {
        return router[method](href, options);
      }

      const currentUrl = new URL(location.href);
      const targetUrl = new URL(href, location.href);
      const sameURL = isSameURL(targetUrl, currentUrl);

      if (sameURL && NProgressOptions?.disableSameURL !== false)
        return router[method](href, options);

      startProgress(NProgressOptions?.startPosition);
      if (sameURL) stopProgress();
      return router[method](href, options);
    },
    [router],
  );

  const push = useCallback(
    (
      href: string,
      options?: NavigateOptions,
      NProgressOptions?: RouterNProgressOptions,
    ) => {
      progress(href, 'push', options, NProgressOptions);
    },
    [router, startProgress],
  );

  const replace = useCallback(
    (
      href: string,
      options?: NavigateOptions,
      NProgressOptions?: RouterNProgressOptions,
    ) => {
      progress(href, 'replace', options, NProgressOptions);
    },
    [router, startProgress],
  );

  const back = useCallback(
    (NProgressOptions?: RouterNProgressOptions) => {
      if (NProgressOptions?.showProgressBar === false) return router.back();
      startProgress(NProgressOptions?.startPosition);
      return router.back();
    },
    [router],
  );

  const refresh = useCallback(
    (NProgressOptions?: RouterNProgressOptions) => {
      if (NProgressOptions?.showProgressBar === false) return router.back();
      startProgress(NProgressOptions?.startPosition);
      stopProgress();
      return router.refresh();
    },
    [router],
  );

  const enhancedRouter = useMemo(() => {
    return { ...router, push, replace, back, refresh };
  }, [router, push, replace, back, refresh]);

  return enhancedRouter;
}
