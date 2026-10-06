import type { UseFormReturn } from "react-hook-form";
import { LLMSelector } from "@/components/llm-selector";
import { RerankerSelector } from "@/components/reranker-selector";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@agentset/ui/accordion";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@agentset/ui/form";
import { Input } from "@agentset/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentset/ui/select";
import { Separator } from "@agentset/ui/separator";
import { Textarea } from "@agentset/ui/textarea";
import { LLM_MODELS } from "@agentset/validation";

import type { HostingFormValues } from "../../use-hosting-form";
import { CorpusSelector } from "../corpus-selector";

interface AIEngineTabProps {
  form: UseFormReturn<HostingFormValues>;
}

/** Radix Select rejects an empty string as an item value, so "not set" needs a
 *  sentinel of its own. */
const SAME_AS_ANSWERING = "__same__";

export function AIEngineTab({ form }: AIEngineTabProps) {
  return (
    <div className="space-y-10">
      <section>
        <div>
          <h2 className="text-lg font-medium">AI Configuration</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure the AI model and behavior for your assistant
          </p>
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col gap-6">
          <FormField
            control={form.control}
            name="llmModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LLM Model</FormLabel>
                <FormControl>
                  <LLMSelector
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  The language model used to generate responses
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="extractionModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Search model</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || SAME_AS_ANSWERING}
                    onValueChange={(v) =>
                      field.onChange(v === SAME_AS_ANSWERING ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SAME_AS_ANSWERING}>
                        Same as answering model
                      </SelectItem>
                      {Object.entries(LLM_MODELS).flatMap(
                        ([provider, models]) =>
                          models.map((m) => (
                            <SelectItem
                              key={`${provider}:${m.model}`}
                              value={`${provider}:${m.model}`}
                            >
                              {m.name}
                            </SelectItem>
                          )),
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Chooses which searches to run against the corpus. Writing a
                  good classical-Arabic query is a different skill from writing
                  the answer, so a stronger model here can improve retrieval
                  without paying for it on every token.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="systemPrompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>System Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    className="h-48 max-h-80 font-mono text-sm"
                    placeholder="Enter your system prompt..."
                  />
                </FormControl>
                <FormDescription>
                  Instructions that define how your AI assistant should behave
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </section>

      <section>
        <div>
          <h2 className="text-lg font-medium">Retrieval</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Reranking, retrieval limits, and citation settings
          </p>
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col gap-6">
          <FormField
            control={form.control}
            name="corpus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Corpus</FormLabel>
                <FormControl>
                  <CorpusSelector
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  Which knowledge base the assistant searches. Searching two
                  pools their results and reranks them together, so passages
                  from either can win on merit — at the cost of one extra query
                  per search.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rerankModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reranker Model</FormLabel>
                <FormControl>
                  <RerankerSelector
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  Model used to rerank retrieved documents for better relevance
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="topK"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Top K</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      max={100}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Documents to retrieve from vector store (1-100)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rerankLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rerank Limit</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      max={100}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Documents after reranking (1-100)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="citationMetadataPath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Citation Metadata Path</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. title or foo.bar" />
                </FormControl>
                <FormDescription>
                  Optional path for citation names. Use dot notation for nested
                  fields (e.g., "foo.bar").
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </section>
    </div>
  );
}
