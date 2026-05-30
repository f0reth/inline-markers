export type StepFn<I, O> = (input: I) => O | Promise<O>;

export interface PipelineStep<I, O> {
  name: string;
  fn: StepFn<I, O>;
}

// NOTE: each step's output type must match the next step's input type — enforce this at the call site
export type Pipeline<T> = {
  pipe<O>(name: string, fn: StepFn<T, O>): Pipeline<O>;
  run(input: T): Promise<T>;
  // FIXME: error does not include the step name that failed
  runSafe(input: T): Promise<{ ok: true; value: T } | { ok: false; error: Error; step: string }>;
};

export function createPipeline<T>(): Pipeline<T> {
  const steps: PipelineStep<unknown, unknown>[] = [];

  const self: Pipeline<T> = {
    pipe<O>(name: string, fn: StepFn<T, O>): Pipeline<O> {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      steps.push({ name, fn: fn as StepFn<unknown, unknown> });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      return self as unknown as Pipeline<O>;
    },

    async run(input: T): Promise<T> {
      let current: unknown = input;
      for (const step of steps) {
        // TODO: add per-step timing and expose as pipeline metrics
        current = await step.fn(current);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      return current as T;
    },

    async runSafe(
      input: T,
    ): Promise<{ ok: true; value: T } | { ok: false; error: Error; step: string }> {
      let current: unknown = input;
      for (const step of steps) {
        try {
          current = await step.fn(current);
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e : new Error(String(e)),
            step: step.name,
          };
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      return { ok: true, value: current as T };
    },
  };

  return self;
}

export function pipeline<T>(): Pipeline<T> {
  return createPipeline<T>();
}

export interface DataRecord {
  id: string;
  payload: Record<string, unknown>;
  tags: string[];
  score: number;
}

export interface NormalizedRecord {
  id: string;
  payload: Record<string, unknown>;
  tags: string[];
  score: number;
  normalizedScore: number;
}

export interface FilteredBatch {
  records: NormalizedRecord[];
  skipped: number;
}

export interface EnrichedBatch {
  records: (NormalizedRecord & { enriched: true })[];
  skipped: number;
  processedAt: number;
}

// NOTE: pipeline is stateless; create a new instance for each batch
export function createDataPipeline(minScore: number) {
  return pipeline<DataRecord[]>()
    .pipe("normalize", (records) => {
      const maxScore = Math.max(...records.map((r) => r.score), 1);
      return records.map((r) => ({
        ...r,
        normalizedScore: r.score / maxScore,
      })) as NormalizedRecord[];
    })
    .pipe("filter", (records: NormalizedRecord[]): FilteredBatch => {
      const filtered = records.filter((r) => r.normalizedScore >= minScore);
      return { records: filtered, skipped: records.length - filtered.length };
    })
    .pipe("enrich", async (batch: FilteredBatch): Promise<EnrichedBatch> => {
      // TODO: replace with a real external enrichment API call
      return {
        records: batch.records.map((r) => ({ ...r, enriched: true as const })),
        skipped: batch.skipped,
        processedAt: Date.now(),
      };
    });
}

export interface BatchProcessor<T, R> {
  process(items: T[]): Promise<R[]>;
  flush(): Promise<void>;
}

// HACK: buffer is unbounded — add a maxBuffer option to avoid OOM on large streams
export function createBatchProcessor<T, R>(
  batchSize: number,
  handler: (batch: T[]) => Promise<R[]>,
): BatchProcessor<T, R> {
  const buffer: T[] = [];
  const results: R[] = [];

  return {
    async process(items: T[]): Promise<R[]> {
      buffer.push(...items);
      const processed: R[] = [];
      while (buffer.length >= batchSize) {
        const batch = buffer.splice(0, batchSize);
        const batchResults = await handler(batch);
        processed.push(...batchResults);
        results.push(...batchResults);
      }
      return processed;
    },
    async flush(): Promise<void> {
      if (buffer.length > 0) {
        const batchResults = await handler(buffer.splice(0));
        results.push(...batchResults);
      }
    },
  };
}

// TODO: add backpressure support for slow consumers
export async function* streamPipeline<T, R>(
  source: AsyncIterable<T>,
  transform: (item: T) => Promise<R>,
): AsyncGenerator<R> {
  for await (const item of source) {
    yield await transform(item);
  }
}
