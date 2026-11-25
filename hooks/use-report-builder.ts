"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import {
  DefinitionDeletedSchema, DefinitionSchema, PreviewSchema, RunDetailSchema,
  type Definition, type DefinitionIn, type DefinitionPatch, type Preview, type RunDetail, type SpecIn,
} from "@/lib/api/report-builder-schemas";

// Report builder writes through the dashboard proxy, which allowlists each
// path and checks each body against the same strict schemas before it
// reaches the API. Every answer is parsed again here.

async function send<S extends z.ZodTypeAny>(
  path: string, method: "POST" | "PATCH", body: unknown, schema: S, fallback: string,
): Promise<z.infer<S>> {
  const response = await fetch(`/api/broka/${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload as { message?: string; code?: string };
    throw new AdminRequestError(error.message ?? fallback, response.status, error.code);
  }
  return schema.parse(payload);
}

const RUNS = ["broka-admin", "reportBuilderRuns"];
const DEFINITIONS = ["broka-admin", "reportBuilderDefinitions"];

export function usePreviewReport() {
  return useMutation<Preview, AdminRequestError, SpecIn>({
    mutationFn: (spec) => send("admin/report-builder/preview", "POST", spec, PreviewSchema, "The preview could not be built."),
  });
}

function useStoreRun<V>(mutationFn: (input: V) => Promise<RunDetail>) {
  const queryClient = useQueryClient();
  return useMutation<RunDetail, AdminRequestError, V>({
    mutationFn,
    onSuccess: (run) => {
      queryClient.setQueryData(["broka-admin", "reportBuilderRunDetail", run.id], run);
      void queryClient.invalidateQueries({ queryKey: RUNS });
      void queryClient.invalidateQueries({ queryKey: DEFINITIONS });
    },
  });
}

export function useCreateRun() {
  return useStoreRun<{ spec: SpecIn; definition_id?: string | null }>((input) =>
    send("admin/report-builder/runs", "POST", input, RunDetailSchema, "The report could not be built."));
}

export function useRegenerateRun() {
  return useStoreRun<string>((id) =>
    send(`admin/report-builder/runs/${encodeURIComponent(id)}/regenerate`, "POST", undefined, RunDetailSchema,
      "The report could not be rebuilt."));
}

export function useRunDefinition() {
  return useStoreRun<string>((id) =>
    send(`admin/report-builder/definitions/${encodeURIComponent(id)}/run`, "POST", undefined, RunDetailSchema,
      "The saved report could not be run."));
}

export function useSaveDefinition() {
  const queryClient = useQueryClient();
  return useMutation<Definition, AdminRequestError, DefinitionIn>({
    mutationFn: (input) => send("admin/report-builder/definitions", "POST", input, DefinitionSchema, "The report could not be saved."),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DEFINITIONS }),
  });
}

export function useUpdateDefinition() {
  const queryClient = useQueryClient();
  return useMutation<Definition, AdminRequestError, { id: string; patch: DefinitionPatch }>({
    mutationFn: ({ id, patch }) => send(`admin/report-builder/definitions/${encodeURIComponent(id)}`, "PATCH", patch,
      DefinitionSchema, "The saved report could not be changed."),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DEFINITIONS }),
  });
}

export function useDeleteDefinition() {
  const queryClient = useQueryClient();
  return useMutation<{ id: string; deleted: true }, AdminRequestError, string>({
    mutationFn: (id) => send(`admin/report-builder/definitions/${encodeURIComponent(id)}/delete`, "POST", undefined,
      DefinitionDeletedSchema, "The saved report could not be removed."),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DEFINITIONS }),
  });
}
