"use client";
import React from "react"
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

export function ChatInterface() {
  const [isMounted, setIsMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    setMessages([
      {
        id: "1",
        text: "Hello! I'm Synthesize AI. How can I help you today?",
        sender: "assistant",
        timestamp: new Date(),
      },
    ]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isMounted) {
      scrollToBottom();
    }
  }, [messages, isMounted]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      text: input,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        text: `I received your message: "${input}". This is a demo response. Connect your AI API to get real responses.`,
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };
  return (
    <div className="flex h-screen flex-col bg-black overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col scrollbar-custom pt-4" ref={scrollAreaRef}>
        <style jsx>{`
          .scrollbar-custom::-webkit-scrollbar {
            width: 6px;
          }
          .scrollbar-custom::-webkit-scrollbar-track {
            background: #000;
          }
          .scrollbar-custom::-webkit-scrollbar-thumb {
            background: #444;
            border-radius: 3px;
          }
          .scrollbar-custom::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
        `}</style>
        <div className="flex-1"></div>
        <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${message.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-white text-black border border-gray-200">
                <p className="text-sm">{message.text}</p>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="rounded-lg bg-white px-4 py-2 border border-gray-200">
                <div className="flex space-x-2">
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" />
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce delay-100" />
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div>
        <form
          onSubmit={handleSendMessage}
          className="mx-auto max-w-2xl px-4 py-4"
        >
          <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2 shadow-md">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 border-none focus-visible:ring-0 text-black placeholder:text-gray-400"
            />

            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-10 w-10 rounded-full bg-black text-white hover:bg-gray-900"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
