"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { PromptNodeData } from "@/types";
import { PromptEditorModal } from "@/components/modals/PromptEditorModal";
import { useToast } from "@/components/Toast";

type PromptNodeType = Node<PromptNodeData, "prompt">;

const ENHANCEMENT_STYLES = [
  { value: "detailed", label: "More Detailed" },
  { value: "professional", label: "Professional" },
  { value: "cinematic", label: "Cinematic" },
  { value: "vivid", label: "Vivid & Colorful" },
  { value: "minimal", label: "Minimal & Clean" },
];

export function PromptNode({ id, data, selected }: NodeProps<PromptNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const incrementModalCount = useWorkflowStore((state) => state.incrementModalCount);
  const decrementModalCount = useWorkflowStore((state) => state.decrementModalCount);
  const [isModalOpenLocal, setIsModalOpenLocal] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanceMenu, setShowEnhanceMenu] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { prompt: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleOpenModal = useCallback(() => {
    setIsModalOpenLocal(true);
    incrementModalCount();
  }, [incrementModalCount]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpenLocal(false);
    decrementModalCount();
  }, [decrementModalCount]);

  const handleSubmitModal = useCallback(
    (prompt: string) => {
      updateNodeData(id, { prompt });
    },
    [id, updateNodeData]
  );

  const duplicateNode = useWorkflowStore((state) => state.duplicateNode);

  const handleDuplicate = useCallback(() => {
    duplicateNode(id);
  }, [id, duplicateNode]);

  const handleEnhance = useCallback(async (style: string) => {
    if (!nodeData.prompt.trim()) {
      useToast.getState().show("Enter a prompt first to enhance", "warning");
      return;
    }

    setIsEnhancing(true);
    setShowEnhanceMenu(false);

    const stylePrompts: Record<string, string> = {
      detailed: "Enhance this image generation prompt by adding specific details about lighting, textures, composition, and camera settings. Keep the core subject but make it more descriptive and detailed:",
      professional: "Transform this into a professional, high-quality image generation prompt suitable for stock photography or commercial use. Focus on clarity, technical quality markers, and professional composition:",
      cinematic: "Transform this into a cinematic movie scene description. Add dramatic lighting, film grain qualities, depth of field, and cinematic color grading details:",
      vivid: "Enhance this prompt to create a vivid, colorful, and visually striking image. Add details about vibrant colors, saturation, lighting effects, and eye-catching visual elements:",
      minimal: "Transform this into a minimal, clean aesthetic prompt. Focus on simplicity, negative space, clean lines, and refined elegance while maintaining the core subject:",
    };

    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${stylePrompts[style]}\n\nOriginal prompt: "${nodeData.prompt}"\n\nEnhanced prompt:`,
          provider: "google",
          model: "gemini-3-flash-preview",
          temperature: 0.7,
          maxTokens: 1024,
        }),
      });

      if (!response.ok) throw new Error("Enhancement failed");

      const result = await response.json();
      if (result.success && result.text) {
        // Clean up the response - remove quotes if present
        let enhanced = result.text.trim();
        if (enhanced.startsWith('"') && enhanced.endsWith('"')) {
          enhanced = enhanced.slice(1, -1);
        }
        updateNodeData(id, { prompt: enhanced });
        useToast.getState().show("Prompt enhanced!", "success");
      }
    } catch (error) {
      useToast.getState().show("Failed to enhance prompt", "error");
    } finally {
      setIsEnhancing(false);
    }
  }, [id, nodeData.prompt, updateNodeData]);

  return (
    <>
      <BaseNode
        id={id}
        title="Prompt"
        customTitle={nodeData.customTitle}
        comment={nodeData.comment}
        onCustomTitleChange={(title) => updateNodeData(id, { customTitle: title || undefined })}
        onCommentChange={(comment) => updateNodeData(id, { comment: comment || undefined })}
        onExpand={handleOpenModal}
        onDuplicate={handleDuplicate}
        selected={selected}
      >
        <textarea
          value={nodeData.prompt}
          onChange={handleChange}
          placeholder="Describe what to generate..."
          className="nodrag nopan nowheel w-full flex-1 min-h-[70px] p-2 text-xs leading-relaxed text-neutral-100 border border-neutral-700 rounded bg-neutral-900/50 resize-none focus:outline-none focus:ring-1 focus:ring-neutral-600 focus:border-neutral-600 placeholder:text-neutral-500"
        />

        {/* AI Enhance Button */}
        <div className="relative">
          <button
            onClick={() => setShowEnhanceMenu(!showEnhanceMenu)}
            disabled={isEnhancing || !nodeData.prompt.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-[10px] font-medium text-neutral-300 bg-neutral-800/80 hover:bg-neutral-700/80 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            {isEnhancing ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Enhancing...</span>
              </>
            ) : (
              <>
                <span>AI Enhance</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>

          {/* Enhancement Style Menu */}
          {showEnhanceMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowEnhanceMenu(false)}
              />
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
                {ENHANCEMENT_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => handleEnhance(style.value)}
                    className="w-full px-3 py-2 text-[10px] text-neutral-300 hover:bg-neutral-700 transition-colors text-left"
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          id="text"
          data-handletype="text"
        />
      </BaseNode>

      {/* Modal - rendered via portal to escape React Flow stacking context */}
      {isModalOpenLocal && createPortal(
        <PromptEditorModal
          isOpen={isModalOpenLocal}
          initialPrompt={nodeData.prompt}
          onSubmit={handleSubmitModal}
          onClose={handleCloseModal}
        />,
        document.body
      )}
    </>
  );
}
