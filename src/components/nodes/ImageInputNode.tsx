"use client";

import { useCallback, useRef, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ImageInputNodeData } from "@/types";
import { useToast } from "@/components/Toast";

type ImageInputNodeType = Node<ImageInputNodeData, "imageInput">;

export function ImageInputNode({ id, data, selected }: NodeProps<ImageInputNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedPrompt, setExtractedPrompt] = useState<string | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
        alert("Unsupported format. Use PNG, JPG, or WebP.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large. Maximum size is 10MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          updateNodeData(id, {
            image: base64,
            filename: file.name,
            dimensions: { width: img.width, height: img.height },
          });
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, {
      image: null,
      filename: null,
      dimensions: null,
    });
    setExtractedPrompt(null);
  }, [id, updateNodeData]);

  const duplicateNode = useWorkflowStore((state) => state.duplicateNode);

  const handleDuplicate = useCallback(() => {
    duplicateNode(id);
  }, [id, duplicateNode]);

  const handleExtractPrompt = useCallback(async () => {
    if (!nodeData.image) {
      useToast.getState().show("Upload an image first", "warning");
      return;
    }

    setIsExtracting(true);
    setShowPromptModal(true);

    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Describe this image in detail as if writing a prompt for an AI image generator. Focus on: subject, style, lighting, colors, composition, mood, and any notable details. Write it as a single paragraph prompt that could be used to recreate this image:",
          images: [nodeData.image],
          provider: "google",
          model: "gemini-3-flash-preview",
          temperature: 0.7,
          maxTokens: 1024,
        }),
      });

      if (!response.ok) throw new Error("Extraction failed");

      const result = await response.json();
      if (result.success && result.text) {
        // Clean up the response
        let prompt = result.text.trim();
        if (prompt.startsWith('"') && prompt.endsWith('"')) {
          prompt = prompt.slice(1, -1);
        }
        setExtractedPrompt(prompt);
        useToast.getState().show("Prompt extracted!", "success");
      } else {
        throw new Error(result.error || "Failed to extract prompt");
      }
    } catch (error) {
      useToast.getState().show("Failed to extract prompt", "error");
      setExtractedPrompt("Failed to analyze image. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  }, [nodeData.image]);

  const handleCopyPrompt = useCallback(() => {
    if (extractedPrompt) {
      navigator.clipboard.writeText(extractedPrompt);
      useToast.getState().show("Copied to clipboard!", "success");
    }
  }, [extractedPrompt]);

  const handleUseInPromptNode = useCallback(() => {
    if (extractedPrompt && extractedPrompt !== "Failed to analyze image. Please try again.") {
      // Add a new prompt node with this prompt
      const store = useWorkflowStore.getState();
      const currentNode = store.getNodeById(id);
      if (currentNode) {
        const promptNodeId = store.addNode("prompt", {
          x: currentNode.position.x + 350,
          y: currentNode.position.y,
        });
        store.updateNodeData(promptNodeId, { prompt: extractedPrompt });
        setShowPromptModal(false);
        useToast.getState().show("Prompt node created!", "success");
      }
    }
  }, [extractedPrompt, id]);

  return (
    <BaseNode
      id={id}
      title="Image"
      customTitle={nodeData.customTitle}
      comment={nodeData.comment}
      onCustomTitleChange={(title) => updateNodeData(id, { customTitle: title || undefined })}
      onCommentChange={(comment) => updateNodeData(id, { comment: comment || undefined })}
      onDuplicate={handleDuplicate}
      selected={selected}
    >
      {/* Reference input handle for visual links from Split Grid node */}
      <Handle
        type="target"
        position={Position.Left}
        id="reference"
        data-handletype="reference"
        className="!bg-gray-500"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {nodeData.image ? (
        <div className="relative group flex-1 flex flex-col min-h-0">
          <img
            src={nodeData.image}
            alt={nodeData.filename || "Uploaded image"}
            className="w-full flex-1 min-h-0 object-contain rounded"
          />
          <button
            onClick={handleRemove}
            className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Extract Prompt Button */}
          <button
            onClick={handleExtractPrompt}
            disabled={isExtracting}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 rounded text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 border border-neutral-700"
          >
            {isExtracting ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Analyzing...</span>
              </>
            ) : (
              <span>Extract Prompt</span>
            )}
          </button>

          <div className="mt-1.5 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-neutral-400 truncate max-w-[120px]">
              {nodeData.filename}
            </span>
            {nodeData.dimensions && (
              <span className="text-[10px] text-neutral-500">
                {nodeData.dimensions.width}x{nodeData.dimensions.height}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full flex-1 min-h-[112px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center cursor-pointer hover:border-neutral-500 hover:bg-neutral-700/50 transition-colors"
        >
          <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-[10px] text-neutral-400 mt-1">
            Drop or click
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="image"
        data-handletype="image"
      />

      {/* Extracted Prompt Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h3 className="text-sm font-medium text-neutral-200">
                Extracted Prompt
              </h3>
              <button
                onClick={() => setShowPromptModal(false)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              {isExtracting ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="w-8 h-8 animate-spin text-neutral-400 mb-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm text-neutral-400">Analyzing image...</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={extractedPrompt || ""}
                    readOnly
                    className="w-full flex-1 min-h-[120px] p-3 text-xs leading-relaxed text-neutral-200 bg-neutral-800/50 border border-neutral-700 rounded-lg resize-none focus:outline-none"
                  />
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleCopyPrompt}
                      disabled={!extractedPrompt || extractedPrompt.startsWith("Failed")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-neutral-300 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={handleUseInPromptNode}
                      disabled={!extractedPrompt || extractedPrompt.startsWith("Failed")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-neutral-900 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Create Prompt Node</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
}
