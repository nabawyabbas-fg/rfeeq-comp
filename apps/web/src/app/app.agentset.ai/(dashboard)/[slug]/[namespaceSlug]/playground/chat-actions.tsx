"use client";

import Link from "next/link";
import { useActiveChat } from "@/components/chat/active-chat.store";
import { useNamespace } from "@/hooks/use-namespace";
import { logEvent } from "@/lib/analytics";
import {
  aiSdkExample,
  curlExample,
  pythonExample,
  tsSdkExample,
} from "@/lib/code-examples/playground";
import { useChatProperty } from "ai-sdk-zustand";
import { Code2Icon, ColumnsIcon, PlusIcon, Settings2Icon } from "lucide-react";

import { Button } from "@agentset/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@agentset/ui/tooltip";

import ApiDialog from "./api-dialog";
import ChatSettings from "./chat-settings";

export default function ChatActions() {
  const setMessages = useChatProperty((state) => state.setMessages);
  const setChatId = useActiveChat((state) => state.setChatId);
  const namespace = useNamespace();

  const resetChat = () => {
    logEvent("chat_reset", { type: "playground" });
    setMessages([]);
    // see the note in the hosted header: without this the next turn overwrites
    // the conversation being left
    setChatId(null);
  };

  return (
    <div className="flex items-center gap-2 pr-5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={resetChat}>
            <PlusIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New Chat</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`${namespace.baseUrl}/playground/compare`}>
              <ColumnsIcon className="size-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Compare corpora</TooltipContent>
      </Tooltip>

      <Tooltip>
        <ChatSettings
          trigger={
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings2Icon className="size-4" />
              </Button>
            </TooltipTrigger>
          }
        />
        <TooltipContent>Parameters</TooltipContent>
      </Tooltip>

      <Tooltip>
        <ApiDialog
          description="Use the API to query the vector store. You'll need make an API key first."
          tabs={[
            { language: "bash", code: curlExample, title: "cURL" },
            { language: "typescript", code: tsSdkExample, title: "TypeScript" },
            {
              language: "typescript",
              code: aiSdkExample,
              title: "TypeScript (AI SDK)",
            },
            { language: "python", code: pythonExample, title: "Python" },
          ]}
          trigger={(props) => (
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetChat}
                {...props}
              >
                <Code2Icon className="size-4" />
              </Button>
            </TooltipTrigger>
          )}
        />
        <TooltipContent>API</TooltipContent>
      </Tooltip>
    </div>
  );
}
