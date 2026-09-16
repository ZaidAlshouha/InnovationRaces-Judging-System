"use client";

import { useQuery } from "@tanstack/react-query";
import { resultsRepository } from "@/lib/data";
import { queryKeys } from "./keys";

export function useResults(hackathonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.results.byHackathon(hackathonId ?? ""),
    queryFn: () => resultsRepository.getProjectResults(hackathonId as string),
    enabled: Boolean(hackathonId),
  });
}
