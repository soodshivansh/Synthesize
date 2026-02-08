"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Plus } from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: "1",
        text: "Hello! I'm Synthesize AI. How can I help you today?",
        sender: "assistant",
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      text: input,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_MCP_URL}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userInput,
          conversationHistory: messages.map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        text: data.response || "Sorry, I couldn't process your request.",
        sender: "assistant",
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        text: "Error connecting to the server. Please try again.",
        sender: "assistant",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.sender === "user"
                    ? "bg-neutral-800 text-neutral-100"
                    : "bg-transparent text-neutral-300"
                }`}
              >
                <div className="text-sm prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 px-4 py-3">
                <div className="h-2 w-2 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.3s]" />
                <div className="h-2 w-2 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.15s]" />
                <div className="h-2 w-2 rounded-full bg-neutral-500 animate-bounce" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-neutral-800 bg-neutral-950 p-4">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSendMessage}>
            <div className="relative rounded-2xl border border-neutral-700 bg-neutral-900 focus-within:border-neutral-600 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask, Search or Chat..."
                rows={1}
                className="w-full resize-none bg-transparent px-4 pt-4 pb-12 text-neutral-100 placeholder:text-neutral-500 focus:outline-none text-sm"
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-neutral-500">Auto</span>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="h-8 w-8 rounded-full bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
