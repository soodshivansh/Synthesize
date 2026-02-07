"use client";
import React from "react"
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      text: input,
      sender: "user",
    };

    console.log("Sending message:", userMessage);

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_MCP_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
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
        text: data.response || "Sorry, I couldn't process your request. client",
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
  return (
    <div className="flex h-screen flex-col bg-black overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col scrollbar-custom pt-4">
        <div className="flex-1"></div>
        <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-white text-black border border-gray-200">
                <div className="text-sm prose prose-sm max-w-none">
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
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
