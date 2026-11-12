"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { readDateRangeParams, writeDateRangeParams, type DateRangeSelection } from "@/lib/date-range";

/**
 * Keeps an analysis window in the URL so a reload or a shared link restores
 * the same range. The default is only a fallback; it never overwrites a valid
 * range already in the query string.
 */
export function useUrlDateRange(fallback: DateRangeSelection) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { from: fallbackFrom, to: fallbackTo, bucket: fallbackBucket } = fallback;

  const selection = useMemo(
    () => readDateRangeParams(
      new URLSearchParams(searchParams.toString()),
      { from: fallbackFrom, to: fallbackTo, bucket: fallbackBucket },
    ),
    [searchParams, fallbackFrom, fallbackTo, fallbackBucket],
  );

  const setSelection = useCallback((next: DateRangeSelection) => {
    const params = writeDateRangeParams(next, new URLSearchParams(searchParams.toString()));
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return [selection, setSelection] as const;
}
